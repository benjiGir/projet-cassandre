"""Produit SVG et relevé N2 à partir des mêmes données.

    python3 tools/metro/layout/produce_plan.py

see: docs/assets/plan-metro.md#reproduire-le-plan
"""
import argparse
from collections import defaultdict
from html import escape
import json
import math
from pathlib import Path
import sys

sys.path.insert(0,str(Path(__file__).resolve().parent))
import plan_n2 as P
from geometry import area, intersection, subtract, cross

ROOT=Path(__file__).resolve().parents[3]
COLORS={'quartier':'#647d88','descente':'#a7b5af','billets':'#c5baa0','quais':'#a5bcaa','tunnel_a':'#90664a','galeries':'#618b82','depot':'#aa925e','tunnel_b':'#896447','poste':'#729bbb','machinerie':'#658591','secret_1':'#cf9dd0','secret_3':'#cf9dd0','secret_2':'#cf9dd0','secret_4':'#cf9dd0','fret':'#b2cbb7','privee':'#b9c9d5','remontee':'#bbc6d2','parvis':'#98adb7'}


def prepare():
    # Les volumes réservés aux niches sont recoupés avec le tube : un seul sol.
    main=[]
    for surface in P.SURFACES:
        pieces=[surface.points]
        if surface.id=='quartier':
            for x0,x1,y0,y1 in P.BLOCKS:
                block=[(x0,y0,0),(x1,y0,0),(x1,y1,0),(x0,y1,0)]
                pieces=[fragment for piece in pieces for fragment in subtract(piece,block)]
        if surface.groupe=='depot':
            for roof in [r for r in P.SURFACES if r.groupe=='secret_3']:
                pieces=[fragment for piece in pieces for fragment in subtract(piece,roof.points)]
        main.extend(P.Surface(surface.id+f'_part_{i}',surface.groupe,piece) for i,piece in enumerate(pieces))
    floors=list(main)
    for niche in P.NICHES:
        pieces=[niche.points]
        for floor in main:
            pieces=[fragment for piece in pieces for fragment in subtract(piece,floor.points)]
        for i,piece in enumerate(pieces):
            if area(piece)<=1e-6: continue
            floors.append(P.Surface(niche.id+f'_part_{i}',niche.groupe,piece))
    return floors


def report(floors):
    errors=[]; overlaps=[]; surfaces=defaultdict(float)
    for i,a in enumerate(floors):
        if area(a.points)<=1e-6: errors.append('sol nul '+a.id)
        surfaces[a.groupe]+=area(a.points)
        for b in floors[i+1:]:
            overlap=area(intersection(a.points,b.points))
            if overlap>1e-5: overlaps.append({'a':a.id,'b':b.id,'m2':round(overlap,4)})
    errors.extend(f"sols superposés : {r['a']} / {r['b']}" for r in overlaps)
    route_rows=[]
    for route in P.ROUTES:
        lengths=[math.dist(a[:2],b[:2]) for a,b in zip(route.points,route.points[1:])]
        slope=max(math.degrees(math.atan2(abs(b[2]-a[2]),d)) for a,b,d in zip(route.points,route.points[1:],lengths))
        if slope>30: errors.append('pente de voie '+route.id)
        route_rows.append({'id':route.id,'length_m':round(sum(lengths),2),'max_segment_m':round(max(lengths),2),'max_slope_deg':round(slope,2),'points':route.points,'role':route.role})
    grid_values=[v for route in P.ROUTES for point in route.points for v in point]
    if any(abs(v*4-round(v*4))>1e-8 for v in grid_values):errors.append('axe de voie hors grille 0,25 m')
    xy=[p for floor in floors for p in floor.points]
    extent={'x':[min(p[0] for p in xy),max(p[0] for p in xy)],'y':[min(p[1] for p in xy),max(p[1] for p in xy)]}
    fits=vehicle_envelopes(floors)
    errors.extend('enveloppe de voiture hors sol : '+k for k,v in fits.items() if v['outside_corners'] or v['outside_rectangles'])
    clusters={k:sum(v.values()) for k,v in P.LIGHT_CLUSTERS.items()}
    if max(clusters.values())>48:errors.append('réservation lumineuse au-delà du pool')
    sightlines=gallery_sightlines(floors)
    if max(sightlines.values())>60:errors.append('galerie droite de plus de 60 m')
    reached={'quartier'}
    while True:
        next_nodes=reached|{b for a,b,_ in P.LINKS if a in reached}
        if next_nodes==reached:break
        reached=next_nodes
    if not {'parvis','secret_1','secret_2','secret_3','secret_4'}<=reached:errors.append('parcours déclaré incomplet')
    return {'escape_budget_s':round((12+3.5+.75)/9+.08+1+.5,3),'gallery_axis_sightlines_m':sightlines,'reachable_nodes':sorted(reached),'light_clusters':clusters,'extent':extent,'vehicle_envelopes':fits,'ok':not errors,'errors':errors,'overlaps':overlaps,'surface_m2':{k:round(v,2) for k,v in surfaces.items()},'total_floor_m2':round(sum(surfaces.values()),2),
        'routes':route_rows,'floor_patches':len(floors),'reserved_niches':len(P.NICHES),'lamp_markers':P.LAMP_BUDGET,'lamp_markers_total':sum(P.LAMP_BUDGET.values()),
        'max_lights_selected':48,'links':P.LINKS,'limits':['Pas de validation Rapier ni de partie jouée : N5.',
        'Les volumes de mobilier, grilles et murs sont à produire ; visibilité vérifiée par segments libres et réservations uniquement.',
        'Le toit de rame secret remplace le sol navigable sous sa caisse ; NPC exclus de cette branche au blockout.',
        'La machinerie réserve le ventilateur central sans sol praticable dans son emprise.']}


def gallery_sightlines(floors):
    polys=[s.points for s in floors if s.groupe=='galeries']
    results={}
    for axis in (0,1):
        other=1-axis
        breaks=sorted({p[other] for poly in polys for p in poly})
        longest=0
        for low,high in zip(breaks,breaks[1:]):
            scan=(low+high)/2; intervals=[]
            for poly in polys:
                values=[]
                for a,b in zip(poly,poly[1:]+poly[:1]):
                    if min(a[other],b[other])<scan<max(a[other],b[other]):
                        t=(scan-a[other])/(b[other]-a[other]);values.append(a[axis]+t*(b[axis]-a[axis]))
                if len(values)>=2:intervals.append((min(values),max(values)))
            merged=[]
            for a,b in sorted(intervals):
                if merged and a<=merged[-1][1]+1e-7:merged[-1]=(merged[-1][0],max(b,merged[-1][1]))
                else:merged.append((a,b))
            longest=max(longest,max((b-a for a,b in merged),default=0))
        results['x' if axis==0 else 'y']=round(longest,2)
    return results


def vehicle_envelopes(floors):
    results={}
    for group,points in [('tunnel_a',P.A_POINTS),('tunnel_b',P.B_POINTS)]:
        polys=[s.points for s in floors if s.groupe==group and not s.id.startswith('niche')]
        lengths=[math.dist(a[:2],b[:2]) for a,b in zip(points,points[1:])]
        travelled=0; failures=0; missing_boxes=0; max_missing=0; samples=0
        for a,b,length in zip(points,points[1:],lengths):
            dx,dy=(b[0]-a[0])/length,(b[1]-a[1])/length
            for step in range(math.ceil(length*2)):
                t=(step+.5)/math.ceil(length*2); at=travelled+t*length
                if at<8 or at>sum(lengths)-8: continue
                samples+=1
                box=[]
                for u,v in [(-7.5,-1.4),(7.5,-1.4),(7.5,1.4),(-7.5,1.4)]:
                    q=(a[0]+t*(b[0]-a[0])+dx*u-dy*v,a[1]+t*(b[1]-a[1])+dy*u+dx*v)
                    box.append(q)
                    if not any(all(cross(c,d,q)>=-1e-6 for c,d in zip(poly,poly[1:]+poly[:1])) for poly in polys): failures+=1
                missing=max(0,42-sum(area(intersection(box,poly)) for poly in polys))
                max_missing=max(max_missing,missing)
                if missing>1e-5:missing_boxes+=1
            travelled+=length
        results[group]={'poses_sampled':samples,'outside_corners':failures,'outside_rectangles':missing_boxes,'max_missing_m2':round(max_missing,6),'step_max_m':0.5,'car_m':[15,2.8],
            'limit':'Enveloppe horizontale aux poses du prototype, rectangle complet à chaque pose échantillonnée. Extrémités hors plan exclues sur 8 m ; masques et raccords 3D à contrôler en T2/N5.'}
    return results


def svg(floors,data):
    scale=2.05
    def xy(x,y):return 290+x*scale,1170-y*scale
    parts=['<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="1340" viewBox="0 0 1280 1340" role="img" aria-labelledby="title desc"><title id="title">Métro N2 — tracé accepté pour poursuivre</title><desc id="desc">Trois paliers, deux objectifs au dépôt, rame fixe et trois boucles de retour.</desc><style>text{font-family:Arial,sans-serif;fill:#e6e9df}.h{font-size:23px;font-weight:bold}.t{font-size:16px}.s{font-size:13px;fill:#b4c4c5}.num{font-size:12px;font-weight:bold;fill:#101b22}</style><rect width="1280" height="1340" fill="#101b22"/><path d="M40,34H1240" stroke="#cf9455" stroke-width="4"/><text x="40" y="77" font-size="32" font-weight="bold">N2 / DU QUARTIER À LA TOUR</text><text x="40" y="107" class="s">Tracé accepté · 06 octobre 2026 · mètres Blender · nord en haut · sols et voies issus des mêmes données que le relevé</text>']
    for surface in floors:
        points=' '.join(f'{x:.2f},{y:.2f}' for x,y in [xy(p[0],p[1]) for p in surface.points])
        parts.append(f'<polygon points="{points}" fill="{COLORS[surface.groupe]}" stroke="#17272d" stroke-width=".7"/>')
    for route in P.ROUTES:
        points=' '.join(f'{x:.2f},{y:.2f}' for x,y in [xy(p[0],p[1]) for p in route.points])
        color='#e1bc65' if route.id=='F' else '#f1d5a1'
        parts.append(f'<polyline points="{points}" fill="none" stroke="{color}" stroke-width="2" stroke-dasharray="4 3"/>')
    for num,name,x,y,z in P.LABELS:
        sx,sy=xy(x,y)
        # Les repères voisins sont décalés, sans déplacer leur ancrage physique.
        shift={'4':(-58,-8),'5':(-25,0),'6':(-65,24),'7':(0,30),'8':(-56,0),'9':(0,-23),'10':(-55,0),'11':(65,0),'3':(-50,0),'2':(-58,0)}.get(num,(0,0))
        tx,ty=sx+shift[0],sy+shift[1]
        parts.append(f'<path d="M{sx},{sy}L{tx},{ty}" stroke="#dbe0cb"/><circle cx="{tx}" cy="{ty}" r="13" fill="#e4d6b0"/><text x="{tx}" y="{ty+4}" text-anchor="middle" class="num">{num}</text>')
    for name,x,y,label in P.SECRETS:
        sx,sy=xy(x,y)
        parts.append(f'<rect x="{sx-12}" y="{sy-9}" width="24" height="18" fill="#deacdd"/><text x="{sx}" y="{sy+4}" text-anchor="middle" class="num">{name}</text>')
    # Deux passages matérialisent la leçon des quais.
    for y in [134,172]:
        x0,y0=xy(-4,y);x1,y1=xy(4,y)
        parts.append(f'<path d="M{x0},{y0}H{x1}" stroke="#fc8d78" stroke-width="4"/>')
    parts.append('<path d="M76,167V131L68,145M76,131L84,145" stroke="#c5d5d6" fill="none"/><text x="68" y="187" class="s">N</text>')
    width=data['extent']['x'][1]-data['extent']['x'][0]; depth=data['extent']['y'][1]-data['extent']['y'][0]
    parts.append(f'<text x="48" y="1250" class="s">Emprise des sols : {width:g} × {depth:g} m · murs en supplément</text>')
    parts.append('<text x="48" y="1218" class="s">S1–S4 : secrets · traversées de voie en rose</text>')
    parts.append('<path d="M50,1272H152.5 M50,1266V1278 M152.5,1266V1278" stroke="#d6d7bf"/><text x="77" y="1298" class="s">50 m</text>')
    parts.append('<path d="M680,135V1305" stroke="#42545d"/>')
    parts.append('<text x="718" y="160" class="h">PARCOURS / TROIS PALIERS</text>')
    sizes=['80 × 72 m','36 × 24 m','18 × 72 m','146 m','≈ 186 m','64 × 44 m','80 m','16 × 16 m','32 × 32 m','61,5 m','18 × 64 m','48 × 34 m']
    for i,(num,name,x,y,z) in enumerate(P.LABELS):
        sy=200+i*35
        parts.append(f'<text x="721" y="{sy}" class="t"><tspan fill="#eccb92">{num.zfill(2)}</tspan>  {escape(name)}</text><text x="930" y="{sy}" class="s">{sizes[i]}</text><text x="1080" y="{sy}" class="s">{escape(z)}</text>')
    lines=[(665,'LE DÉPÔT EST LE CARREFOUR',True),(704,'A · Tunnel B → aiguillage → même tunnel au retour.',False),(733,'B · Machinerie → seconde rampe vers le dépôt.',False),(762,'A et B dans l’ordre voulu ; arène puis embarquement.',False),
           (812,'LES TROIS BOUCLES',True),(851,'Billets → grille de la bouche → quartier.',False),(880,'Galeries → après la grille du tunnel A.',False),(909,'Machinerie → dépôt par un autre accès.',False),
           (959,'LE VOYAGE EST UN TRUCAGE',True),(998,'La rame de 61,5 m reste fixe, à côté du quai privé.',False),(1027,'Mur et masque séparent départ et arrivée.',False),(1056,'Aucune porte du dépôt ne donne directement sur le quai.',False),
           (1106,'À RELIRE AVANT LE BLOCKOUT',True),(1145,'Niches, escaliers et angles de voies réservés.',False),(1174,f"{data['lamp_markers_total']} marqueurs fixes ; pool par défaut de 48 lampes.",False),(1203,'Enveloppes de voitures et portes restent à intégrer en T2/N5.',False)]
    for y,text,bold in lines:parts.append(f'<text x="718" y="{y}" class="{"h" if bold else "s"}">{escape(text)}</text>')
    parts.append('</svg>')
    return ''.join(parts)


def main():
    parser=argparse.ArgumentParser(description=__doc__.splitlines()[0]);parser.add_argument('--out',default=str(ROOT/'docs/assets'))
    args=parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else None)
    out=Path(args.out);out.mkdir(parents=True,exist_ok=True)
    floors=prepare();data=report(floors)
    (out/'plan-metro-releve.json').write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
    (out/'plan-metro.svg').write_text(svg(floors,data))
    print(json.dumps({'ok':data['ok'],'patches':data['floor_patches'],'niches':data['reserved_niches'],'surface_m2':data['total_floor_m2'],'errors':data['errors'],'out':str(out)},ensure_ascii=False))
    return 0 if data['ok'] else 1


if __name__=='__main__':raise SystemExit(main())
