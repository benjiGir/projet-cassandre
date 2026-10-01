"""Chemins d'import des scripts du niveau v2 : à importer EN PREMIER par chaque module d'`espaces/`."""

import os
import sys

NIVEAU = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))   # tools/level_v2
BLENDER = os.path.join(os.path.dirname(NIVEAU), "blender")             # tools/blender
sys.path.insert(0, NIVEAU)
sys.path.insert(0, BLENDER)
