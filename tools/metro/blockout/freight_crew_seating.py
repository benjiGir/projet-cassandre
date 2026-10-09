"""Banquettes de l'équipe dans la troisième voiture.

see: docs/assets/tunnels-references.md#sièges-de-la-troisième-voiture--9-octobre
"""
from math import pi

from tools.metro.blockout.freight_entry_seating import FLOOR, bench, handrails


def build(a):
    for y in (399.8,402.6):
        bench(a,'n5_fret_equipe_ouest_'+str(y),(37.75,y,FLOOR),0,folded=y==402.6)
        bench(a,'n5_fret_equipe_est_'+str(y),(41.25,y+1.35,FLOOR),pi,folded=y==399.8)
    handrails(a,'n5_fret_equipe_barres',399.745,404.005)
