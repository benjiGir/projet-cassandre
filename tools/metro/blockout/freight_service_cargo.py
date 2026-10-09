"""Outillage arrimé dans la deuxième voiture de service.

see: docs/assets/tunnels-references.md#charges-de-la-deuxième-voiture--9-octobre
"""
from math import cos, pi, sin

from mathutils import Vector

from tools.metro.quartier.geometry import Piece
from tools.metro.quartier.site_details import install


FLOOR = -17.25


def tube(p,a,b,radius=.018,material='acier'):
    a,b=Vector(a),Vector(b)
    obj=p.cylinder((0,0,0),radius,(b-a).length,material,sides=12)
    rotation=(b-a).to_track_quat('Z','Y').to_matrix()
    for v in obj.data.vertices:
        v.co=rotation @ v.co+(a+b)/2


def chamfer(p,x,y,z,width,length,height,material):
    c=.035
    outline=((x+c,y),(x+width-c,y),(x+width,y+c),(x+width,y+length-c),
             (x+width-c,y+length),(x+c,y+length),(x,y+length-c),(x,y+c))
    verts=[(xx,yy,zz) for zz in (z,z+height) for xx,yy in outline]
    faces=[tuple(reversed(range(8))),tuple(range(8,16))]
    faces += [(i,(i+1)%8,(i+1)%8+8,i+8) for i in range(8)]
    p.mesh(verts,faces,material)


def base(p):
    p.box((0,0,0),(.62,2.4,.09),'acier')
    for x in (0,.56):
        p.box((x,0,.09),(.06,2.4,.03),'acier')
    for y in (0,1.15,2.34):
        p.box((0,y,.09),(.62,.06,.03),'acier')
    p.box((.04,.06,.09),(.54,2.28,.03),'acier')
    p.proxy((0,0,0),(.62,2.4,.12))


def case(p,y,z,height,material='petrole'):
    chamfer(p,.06,y,z,.50,.70,height,material)
    chamfer(p,.04,y-.02,z+height,.54,.74,.025,'nuit')
    chamfer(p,.04,y-.02,z+height+.025,.54,.74,.055,material)
    for yy in (y+.10,y+.58):
        p.box((.555,yy,z+height-.07),(.035,.055,.15),'acier')
        p.box((.584,yy+.012,z+height-.02),(.015,.03,.09),'ivoire')
    for yy in (y+.22,y+.48):
        p.box((.557,yy,z+.13),(.032,.045,.065),'acier')
        tube(p,(.584,yy+.022,z+.16),(.592,yy+.022,z+.205),.015)
    tube(p,(.592,y+.242,z+.205),(.592,y+.502,z+.205),.022,'nuit')
    for yy in (y+.05,y+.62):
        p.box((.09,yy,z+height+.08),(.44,.03,.025),'acier')
    for yy in (y+.08,y+.61):
        p.box((.055,yy,z+.03),(.018,.035,height-.06),'acier')
    p.proxy((.04,y-.02,z),(.57,.74,height+.105))


def strap(p,y,top):
    p.box((.027,y,.11),(.017,.065,top-.11),'ambre')
    p.box((.58,y,.11),(.017,.065,top-.11),'ambre')
    p.box((.027,y,top),(.57,.065,.017),'ambre')
    for x in (.013,.573):
        p.box((x,y-.015,.10),(.04,.095,.025),'acier')
        for yy in (y-.007,y+.072):
            p.cylinder((x+.02,yy,.13),.011,.017,'acier',sides=6)
    p.box((.597,y-.01,.26),(.018,.085,.14),'acier')
    tube(p,(.611,y+.035,.28),(.611,y+.035,.37),.008)


def cases(a):
    p=Piece('n5_fret_charges_valises',a.mats,'valises nervurées, poignées, fermetures et sangles au socle')
    base(p)
    case(p,.12,.12,.30)
    case(p,.12,.525,.25,'acier')
    case(p,1.03,.12,.35)
    case(p,1.03,.575,.22)
    for y,top in ((.30,.855),(.67,.855),(1.20,.875),(1.56,.875)):
        strap(p,y,top)
    install(a,p,(37.8,386,FLOOR))


def cable_turn(p,x,y,z):
    verts=[]
    for xx in (x-.009,x+.009):
        for r in (.224,.240):
            verts.extend((xx,y+r*cos(2*pi*i/24),z+r*sin(2*pi*i/24)) for i in range(24))
    faces=[]
    for i in range(24):
        j=(i+1)%24
        faces.extend(((i,j,j+24,i+24),(i+48,i+72,j+72,j+48),
                      (i+24,j+24,j+72,i+72),(i,i+48,j+48,j)))
    p.mesh(verts,faces,'petrole')


def reel(p,y,flange):
    z=.49
    p.cylinder((.31,y,z),.224,.32,'nuit','X',24)
    for x in (.19,.235,.28,.325,.37,.415):
        cable_turn(p,x,y,z)
    for x in (.135,.485):
        p.cylinder((x,y,z),.27,.035,flange,'X',24)
    tube(p,(.075,y,z),(.55,y,z),.038)
    p.cylinder((.104,y,z),.13,.03,'acier','X',16)
    for yy,dz in ((-.065,-.045),(.065,-.045),(0,.065)):
        p.cylinder((.083,y+yy,z+dz),.038,.016,'ivoire','X',12)
        p.cylinder((.072,y+yy,z+dz),.026,.010,'nuit','X',12)
    for x in (.08,.54):
        tube(p,(x,y-.29,.144),(x,y+.29,.144),.024)
        for yy in (y-.23,y+.23):
            tube(p,(x,yy,.144),(x,y,z),.022)
    for yy in (y-.18,y+.18):
        tube(p,(.54,yy,.144),(.54,yy,.91),.021)
    tube(p,(.54,y-.18,.91),(.54,y+.18,.91),.028,'nuit')
    tube(p,(.079,y+.085,z),(.079,y+.16,z-.12),.018)
    tube(p,(.079,y+.16,z-.12),(.027,y+.16,z-.12),.025,'nuit')
    for yy in (y-.24,y+.24):
        p.box((.025,yy-.035,.162),(.57,.07,.018),'acier')
        for x in (.045,.575):
            p.box((x-.02,yy-.04,.115),(.04,.08,.047),'acier')
            p.cylinder((x,yy,.19),.015,.021,'ivoire',sides=6)
    p.proxy((.015,y-.32,.12),(.58,.64,.84))


def reels(a):
    p=Piece('n5_fret_charges_enrouleurs',a.mats,'deux enrouleurs sur pieds, câbles, prises et brides au socle')
    base(p)
    reel(p,.60,'ambre')
    reel(p,1.76,'acier')
    install(a,p,(40.58,386,FLOOR))


def build(a):
    cases(a)
    reels(a)
