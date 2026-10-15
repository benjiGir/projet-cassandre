"""Profil commun des voûtes, portails et suspensions.

see: docs/4-technique/blockout-metro.md#géométrie
"""
import math

from tools.metro.blockout import layout as P

SEGMENTS = 24


def profile(spring,crown):
    return [((1-math.cos(math.pi*i/SEGMENTS))/2,
             spring+(crown-spring)*math.sin(math.pi*i/SEGMENTS))
            for i in range(SEGMENTS+1)]


def height_at(t,spring,crown):
    points=profile(spring,crown)
    for (a,za),(b,zb) in zip(points,points[1:]):
        if a-1e-8<=t<=b+1e-8:
            return za+(zb-za)*(t-a)/(b-a)
    raise ValueError(f'point hors profil de voûte : {t}')


def station_height(x):
    return P.QUAI_Z+height_at((x+9)/18,2.8,6.5)
