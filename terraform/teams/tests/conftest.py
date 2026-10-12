import sys

# Pas de __pycache__ dans template/ : Terraform pousse tout ce que fileset() voit.
sys.dont_write_bytecode = True
