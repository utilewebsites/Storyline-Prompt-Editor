#!/bin/bash
# Ga naar de directory van dit script
cd "$(dirname "$0")"

echo "Starting Wan2GP Bridge..."

# Check of python venv bestaat, anders maak aan (optioneel, maar netjes)
if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
fi

# Activeer venv
source venv/bin/activate

# Installeer dependencies
pip install -r requirements.txt

# Start bridge
python3 wan2gp_bridge.py
