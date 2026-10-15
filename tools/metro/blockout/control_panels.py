"""Commandes originales N5, construites par C.metro_blockout().

Façade locale -Y ; origin et identifiant du use restent ceux du scénario.
see: docs/4-technique/blockout-metro.md
"""
from tools.metro.quartier.geometry import Piece
from tools.metro.quartier.site_details import install


def enclosure(p, width, height, depth=.16, material='acier'):
    cut=.055
    w,h=width/2,height/2
    outline=((-w+cut,-h),(w-cut,-h),(w,-h+cut),(w,h-cut),
             (w-cut,h),(-w+cut,h),(-w,h-cut),(-w,-h+cut))
    vertices=[(x*scale,y,z*scale) for y,scale in ((.07,1),(-depth+.025,1),(-depth,.93))
              for x,z in outline]
    faces=[tuple(reversed(range(8))),tuple(range(16,24))]
    faces.extend((offset+i,offset+(i+1)%8,offset+8+(i+1)%8,offset+8+i)
                 for offset in (0,8) for i in range(8))
    return p.mesh(vertices,faces,material)


def symbol(p, variant, y, z):
    if variant=='stop':
        p.box((-.064,y,z-.064),(.128,.007,.128),'ivoire')
    elif variant=='power':
        points=((-.01,z+.074),(-.056,z-.015),(.002,z-.015),(-.014,z-.084),(.067,z+.014),(.015,z+.014))
        p.mesh([(x,y,zz) for x,zz in points],[(0,1,2,3,4,5)],'nuit')
    elif variant=='switch':
        for start,end in (((0,z-.07),(0,z+.005)),((0,z+.005),(-.065,z+.07)),((0,z+.005),(.065,z+.07))):
            p.beam((start[0],y,start[1]),(end[0],y,end[1]),.025,'nuit')
    else:
        p.mesh([(-.055,y,z-.072),(.065,y,z),(-.055,y,z+.072)],[(0,1,2)],'ivoire')


def create(a,name,at,angle=0,label=None,target=None,variant=None,mount='wall',pedestal_height=1.2):
    """Retourne le mesh use ; aucun nouveau comportement ni collider de décor."""
    variant=variant or ('stop' if '_stop_' in name else 'start')
    if variant not in ('stop','power','switch','start'):
        raise ValueError(f'Variante de commande inconnue : {variant}')
    if mount not in ('wall','pedestal'):
        raise ValueError(f'Support de commande inconnu : {mount}')
    ident=name.removeprefix('use_')
    p=Piece(ident+'_commande',a.mats,'coffret métallique biseauté, poussoir saillant et pictogramme')
    body=enclosure(p,.62,.68)
    p.collection.objects.unlink(body)
    a.logic.objects.link(body)
    body.name=name
    body.location=at
    body.rotation_euler.z=angle
    if target:
        body['target'],body['message']=target,label
    p.box((-.255,-.175,-.285),(.51,.027,.57),'nuit')
    p.box((-.244,-.207,.145),(.488,.025,.096),'ivoire')
    caption=label or ('ARRET' if variant=='stop' else {'power':'COURANT','switch':'AIGUILLAGE','start':'MARCHE'}[variant])
    p.text(caption,(0,-.2085,.17),min(.09,.46/max(len(caption),1)*1.5),'nuit')
    for x in (-.252,.252):
        for z in (-.276,.276):
            p.cylinder((x,-.175,z),.018,.019,'ivoire','Y',8)
    center=-.065
    ring='ambre' if variant=='stop' else 'acier'
    radius=.18 if variant=='stop' else .155
    p.cylinder((0,-.213,center),radius,.042,ring,'Y',16)
    p.cylinder((0,-.242,center),.145 if variant=='stop' else .122,.035,'nuit','Y',16)
    button='rouge' if variant=='stop' else 'ambre' if variant=='power' else 'ivoire' if variant=='switch' else 'petrole'
    front=-.292 if variant=='stop' else -.279
    p.cylinder((0,(front-.255)/2,center),.145 if variant=='stop' else .113,abs(front+.255),button,'Y',16)
    symbol(p,variant,front-.005,center)
    if variant!='stop':
        p.box((-.055,-.21,-.257),(.11,.018,.035),'ivoire')
    if mount=='pedestal':
        p.box((-.11,.05,-pedestal_height),(.22,.2,pedestal_height-.34),'acier')
        p.box((-.22,-.025,-pedestal_height),(.44,.35,.085),'acier')
    else:
        for z in (-.32,.26):
            p.box((-.25,.065,z),(.5,.09,.06),'acier')
    install(a,p,at,angle)
    return body
