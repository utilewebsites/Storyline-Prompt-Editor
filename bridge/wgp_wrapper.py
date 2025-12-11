import sys
import os
import runpy

# Configuratie
# Pas dit pad aan naar jouw lokale Wan2GP installatie
WAN2GP_DIR = "/path/to/your/Wan2GP"
WGP_SCRIPT = os.path.join(WAN2GP_DIR, "wgp.py")

# Memory Profile Configuratie
# Profiel 0: LowRAM_LowVRAM (16GB RAM + 12GB VRAM)
# Profiel 1: HighRAM_HighVRAM (64GB RAM + 24GB VRAM) - AANBEVOLEN voor dit systeem
# Profiel 2: LowRAM_HighVRAM (16GB RAM + 24GB VRAM)
# Profiel 3: HighRAM_LowVRAM (64GB RAM + 12GB VRAM)
# Profiel 4: Auto (laat WanGP beslissen)
FORCE_MEMORY_PROFILE = 1  # Forceer altijd profiel 1 (volledige VRAM loading, ~23GB usage)

# GPU VRAM Configuratie (voor VAE tiling berekening)
# Stel in op je echte GPU VRAM (bytes). 24GB = 25769803776 bytes
# Lagere waarde = conservatievere VAE tiling (langzamer maar veiliger)
# Hogere waarde = agressievere VAE tiling (sneller maar meer VRAM)
FAKE_GPU_VRAM_BYTES = 25769803776  # 24 GB (RTX 3090)

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

    # Patch 4: Configureer GPU memory voor VAE tiling calculation
    import torch.cuda
    original_get_device_properties = torch.cuda.get_device_properties

    def patched_get_device_properties(device):
        props = original_get_device_properties(device)
        # Overschrijf total_memory met configureerbare waarde
        # Dit beïnvloedt VAE tiling berekeningen
        class FakeProps:
            def __init__(self, original):
                self.name = original.name
                self.major = original.major
                self.minor = original.minor
                self.total_memory = FAKE_GPU_VRAM_BYTES
                self.multi_processor_count = original.multi_processor_count
        
        return FakeProps(props)

    torch.cuda.get_device_properties = patched_get_device_properties
    vram_gb = FAKE_GPU_VRAM_BYTES / (1024**3)
    print(f"[Wrapper] Patched torch.cuda.get_device_properties to report {vram_gb:.1f}GB VRAM")

except ImportError:
    print("[Wrapper] Could not import mmgp to patch it.")
except Exception as e:
    print(f"[Wrapper] Error patching mmgp: {e}")

# 3. Patch wgp.py runtime om PIL Image bug te fixen (lijn 805)
# We lezen het bestand, patchen de problematische regel, en voeren het uit
import tempfile
import shutil

try:
    # Lees wgp.py
    with open(WGP_SCRIPT, 'r', encoding='utf-8') as f:
        wgp_code = f.read()
    
    # Patch lijn 805: len(image_start or []) werkt niet met PIL Images
    # Origineel: if model_def.get("black_frame", False) and len(image_start or [])==0:
    # Gepatched: if model_def.get("black_frame", False) and len(image_start if isinstance(image_start, list) else ([image_start] if image_start else []))==0:
    
    original_line = 'if model_def.get("black_frame", False) and len(image_start or [])==0:'
    patched_line = 'if model_def.get("black_frame", False) and len(image_start if isinstance(image_start, list) else ([image_start] if image_start else []))==0:'
    
    if original_line in wgp_code:
        wgp_code = wgp_code.replace(original_line, patched_line)
        print("[Wrapper] Patched wgp.py line 805 to handle single PIL Images (Wan2.2 bug fix)")
        
        # Schrijf gepatched code naar temp file
        temp_wgp = tempfile.NamedTemporaryFile(mode='w', suffix='.py', delete=False, dir=WAN2GP_DIR, encoding='utf-8')
        temp_wgp.write(wgp_code)
        temp_wgp.close()
        
        # Gebruik gepatched versie
        WGP_SCRIPT_PATCHED = temp_wgp.name
    else:
        print("[Wrapper] Warning: Could not find line 805 pattern to patch, using original wgp.py")
        WGP_SCRIPT_PATCHED = WGP_SCRIPT
        
except Exception as e:
    print(f"[Wrapper] Error patching wgp.py: {e}, using original")
    WGP_SCRIPT_PATCHED = WGP_SCRIPT

# 4. Memory profile management
# Check of --profile argument al in sys.argv staat (van bridge)
if '--profile' in sys.argv:
    profile_idx = sys.argv.index('--profile')
    if profile_idx + 1 < len(sys.argv):
        print(f"[Wrapper] Memory profile van bridge: {sys.argv[profile_idx + 1]}")
elif FORCE_MEMORY_PROFILE is not None:
    # Geen --profile van bridge, gebruik fallback configuratie
    sys.argv.extend(['--profile', str(FORCE_MEMORY_PROFILE)])
    print(f"[Wrapper] Geforceerd memory profile {FORCE_MEMORY_PROFILE} (HighRAM_HighVRAM) - fallback configuratie")
else:
    print("[Wrapper] Geen memory profile ingesteld, WanGP gebruikt default")

# 5. Run wgp.py (mogelijk gepatched)
# We moeten de working directory goed zetten, want wgp.py gaat uit van relatieve paden
os.chdir(WAN2GP_DIR)

print(f"[Wrapper] Launching {WGP_SCRIPT_PATCHED} with args: {sys.argv[1:]}")

try:
    # run_path voert het script uit alsof het direct aangeroepen is
    runpy.run_path(WGP_SCRIPT_PATCHED, run_name="__main__")
    
    # Cleanup temp file
    if WGP_SCRIPT_PATCHED != WGP_SCRIPT and os.path.exists(WGP_SCRIPT_PATCHED):
        os.unlink(WGP_SCRIPT_PATCHED)
        
except Exception as e:
    # Cleanup temp file ook bij error
    if 'WGP_SCRIPT_PATCHED' in locals() and WGP_SCRIPT_PATCHED != WGP_SCRIPT and os.path.exists(WGP_SCRIPT_PATCHED):
        os.unlink(WGP_SCRIPT_PATCHED)
        
    import traceback
    print(f"[Wrapper] Error running wgp.py: {e}")
    print("[Wrapper] Full traceback:")
    traceback.print_exc()
    sys.exit(1)
