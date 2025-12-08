import sys
import os
import runpy

# Configuratie
# Pas dit pad aan naar jouw lokale Wan2GP installatie
WAN2GP_DIR = "/home/admin2025/Documenten/ai-server/Wan2GP"
WGP_SCRIPT = os.path.join(WAN2GP_DIR, "wgp.py")

# 1. Setup Path
if WAN2GP_DIR not in sys.path:
    sys.path.insert(0, WAN2GP_DIR)

# 2. Monkeypatch mmgp & version check
try:
    # Patch 1: Missing function
    import mmgp.fp8_quanto_bridge
    if not hasattr(mmgp.fp8_quanto_bridge, 'enable_fp8_marlin_fallback'):
        print("[Wrapper] Patching missing enable_fp8_marlin_fallback...")
        mmgp.fp8_quanto_bridge.enable_fp8_marlin_fallback = lambda: None

    # Patch 2: Version check bypass
    import importlib.metadata
    original_version = importlib.metadata.version
    
    def patched_version(package_name):
        if package_name == "mmgp":
            print("[Wrapper] Faking mmgp version to 3.6.9")
            return "3.6.9"
        return original_version(package_name)
        
    importlib.metadata.version = patched_version

    # Patch 3: Fix preprocess_sd signature mismatch
    import mmgp.offload
    original_load_model_data = mmgp.offload.load_model_data

    def patched_load_model_data(model, checkpoint_path, writable_tensors=False, preprocess_sd=None, **kwargs):
        if preprocess_sd:
            original_preprocess = preprocess_sd
            def wrapped_preprocess(sd, quantization_map=None):
                result = original_preprocess(sd)
                return result, quantization_map
            preprocess_sd = wrapped_preprocess
            
        return original_load_model_data(model, checkpoint_path, writable_tensors=writable_tensors, preprocess_sd=preprocess_sd, **kwargs)

    mmgp.offload.load_model_data = patched_load_model_data
    print("[Wrapper] Patched mmgp.offload.load_model_data for preprocess_sd compatibility")

    # Patch 4: Fake GPU memory for VAE tiling calculation
    import torch.cuda
    original_get_device_properties = torch.cuda.get_device_properties

    def patched_get_device_properties(device):
        props = original_get_device_properties(device)
        # We maken een nieuwe klasse of object dat zich gedraagt als de properties
        # maar met minder geheugen, zodat get_VAE_tile_size conservatiever is.
        # We mikken op < 12000 MB (12GB) om use_vae_config = 3 te forceren.
        # 11GB = 11 * 1024 * 1024 * 1024 = 11811160064 bytes
        class FakeProps:
            def __init__(self, original):
                self.name = original.name
                self.major = original.major
                self.minor = original.minor
                self.total_memory = 11811160064 # 11 GB
                self.multi_processor_count = original.multi_processor_count
        
        return FakeProps(props)

    torch.cuda.get_device_properties = patched_get_device_properties
    print("[Wrapper] Patched torch.cuda.get_device_properties to report 11GB VRAM for safer VAE tiling")

except ImportError:
    print("[Wrapper] Could not import mmgp to patch it.")
except Exception as e:
    print(f"[Wrapper] Error patching mmgp: {e}")

# 3. Run wgp.py
# We moeten de working directory goed zetten, want wgp.py gaat uit van relatieve paden
os.chdir(WAN2GP_DIR)

print(f"[Wrapper] Launching {WGP_SCRIPT} with args: {sys.argv[1:]}")

try:
    # run_path voert het script uit alsof het direct aangeroepen is
    runpy.run_path(WGP_SCRIPT, run_name="__main__")
except Exception as e:
    print(f"[Wrapper] Error running wgp.py: {e}")
    sys.exit(1)
