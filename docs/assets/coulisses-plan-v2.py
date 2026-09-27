import sys; sys.path.insert(0,"/Users/benji/Developer/boomer-shooter/tools/level_v2")
import plan_de_masse as p
from plan_de_masse import Space
OLD={"vestiaires","fournil","pc_secu","boucherie","sav","compacteur","secret4"}
NEW=[
 Space(id="pc_secu", nom="PC sécurité", x=(34,46), y=(140,152), z=0, hauteur=3.0,
   role="Répit. Guichet vitré face à la rampe : on le voit en sortant du souterrain. Console caméras.",
   duree="0:30", arrivee=(40,141), ennemis="aucun — le vigile dort",
   reperes=[("console caméras (E)",40,150,"objet"),("guichet vitré",40,140.25,"objet"),("donuts +5",44,146,"nourriture")]),
 Space(id="vestiaires", nom="Vestiaires + pointeuse", x=(20,34), y=(140,152), z=0, hauteur=3.0,
   role="Pointeuse (gag), rangées de casiers, douches ; casier du vigile cadenassé (à casser)",
   duree="0:30", arrivee=(27,141), ennemis="1 Costard entre les casiers",
   spawns=[("suit_vs1",23,147,"rangée de casiers (1,9 m)")],
   reperes=[("pointeuse (E)",33,141,"objet"),("casier du vigile (cassable)",21,148,"objet"),("sandwich +10",30,148,"nourriture")]),
 Space(id="fournil", nom="Fournil / rôtisserie", x=(8,20), y=(140,156), z=0, hauteur=4.5,
   role="Labo chaud : four à sole, chambre de pousse qui déborde (gag), rôtissoire. Plan de travail → gaine",
   duree="0:40", arrivee=(14,141), ennemis="2 Costards",
   spawns=[("suit_fo1",10,153,"four à sole"),("suit_fo2",18,154,"chariots à grilles")],
   reperes=[("chambre de pousse (E)",10,146,"objet"),("poulet rôti +25",18,145,"nourriture"),("sacs de farine",12,155,"objet")]),
 Space(id="gaine", nom="Gaine VMC", x=(20,46), y=(152,154), z=2.0, hauteur=2.0, grimpable=True,
   role="Route parallèle du fournil au PC sécurité, cache à mi-chemin",
   reperes=[("cache gaine (munitions +24)",30,153,"munitions")]),
 Space(id="labo", nom="Labo boucherie / marée", x=(-60,-44), y=(84,98), z=0, hauteur=3.5,
   role="Blanc vif. Vitre sur les rayons : vu depuis la surface de vente bien avant. Trancheuse, vivier",
   duree="0:40", arrivee=(-45,91), ennemis="2 Costards, visibles depuis les rayons",
   spawns=[("suit_lb1",-58,96,"étal réfrigéré (1,7 m)"),("suit_lb2",-54,87,"vivier")],
   reperes=[("vitre sur les rayons",-48,84.25,"objet"),("vivier à homards",-56,93,"objet"),("jambon +15",-58,86,"nourriture")]),
 Space(id="chambre_froide", nom="Chambre froide", x=(-60,-44), y=(98,116), z=0, hauteur=4.0,
   role="Froid, sombre. Carcasses sur rail jusqu'au labo, rideau à lanières. Bouton « personne enfermée »",
   duree="0:40", arrivee=(-45,107), ennemis="2 Costards entre les carcasses",
   spawns=[("suit_cf1",-56,113,"rangée de carcasses"),("suit_cf2",-54,101,"rangée de carcasses")],
   reperes=[("bouton personne enfermée (E)",-59.5,114,"objet"),("rail + lanières",-52,98.25,"objet")]),
 Space(id="compacteur", nom="Local compacteur", x=(-36,-24), y=(112,128), z=0, hauteur=5.0,
   role="Répit, un projecteur. Grille sur le quai (déjà traversé), porte à sens unique vers la réserve. Balles de carton",
   duree="0:20", arrivee=(-35,120), ennemis="aucun",
   reperes=[("bouton compacteur (E)",-34,114,"objet"),("grille sur le quai",-24.25,120,"objet"),("balle mal cerclée",-32,127,"objet")]),
 Space(id="secret4", nom="Planque du vigile (secret 4)", x=(-36,-28), y=(128,132), z=0, hauteur=2.5,
   role="Butin sous antivol, clé du crochet vide, télé qui passe le foot",
   reperes=[("secret 4",-32,130,"secret"),("pizza +25",-35,129,"nourriture")]),
 Space(id="sav", nom="Atelier SAV", x=(12,32), y=(80,90), z=0, hauteur=4.0,
   role="Derrière l'électroménager : guichet SAV sur le rayon TV, mur de téléviseurs en réparation",
   duree="0:30", arrivee=(22,81), ennemis="2 Costards derrière les établis",
   spawns=[("suit_sv1",14,88,"établi"),("suit_sv2",30,88,"rayonnage")],
   reperes=[("guichet + sonnette (E)",22,80.25,"objet"),("mur de TV",22,89.5,"objet"),("micro-ondes",28,84,"objet")]),
]
p.SPACES[:]=[s for s in p.SPACES if s.id not in OLD]+NEW
p.ALL[:]=p.SPACES+p.CORRIDORS
for k in [k for k in p.PASSAGES if k & OLD]: del p.PASSAGES[k]
p.JONCTIONS_SCELLEES.difference_update({k for k in p.JONCTIONS_SCELLEES if k & OLD})
F=frozenset
p.PASSAGES.update({
 F({"c_bu","pc_secu"}):(1.5,38.0), F({"pc_secu","vestiaires"}):(1.0,145.0),
 F({"c_bu","vestiaires"}):(1.5,24.0), F({"vestiaires","fournil"}):(1.5,145.0),
 F({"c_bu","fournil"}):(2.0,16.0),
 F({"fournil","gaine"}):(1.5,153.0), F({"pc_secu","gaine"}):(1.5,44.0),
 F({"c_short_w","labo"}):(2.0,91.0), F({"labo","chambre_froide"}):(2.0,-52.0),
 F({"c_short_w","chambre_froide"}):(1.5,107.0),
 F({"c_short_w","compacteur"}):(2.5,122.0), F({"compacteur","reserve"}):(2.5,116.0),
 F({"compacteur","secret4"}):(1.25,-32.0), F({"electro","sav"}):(1.5,14.0),
})
p.JONCTIONS_SCELLEES.update({F({"rayons","labo"}),F({"reserve","labo"}),F({"reserve","chambre_froide"}),
 F({"c_short_ramp","secret4"}),F({"c_short_w","secret4"}),F({"fournil","c_escalier"}),F({"vestiaires","gaine"}),F({"bureaux","fournil"}),F({"bureaux","gaine"})})
p.PORTES_SENS_UNIQUE[F({"compacteur","reserve"})]=("compacteur","reserve")
p.NOUVEAUX={s.id for s in NEW}
