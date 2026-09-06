# Outils de documentation

Aucun ne dépend de Blender ni de Node. **Les deux sont testés.**

| Script | Rôle |
|---|---|
| `audit_comments.py` | classe les commentaires d'une base TS/JS, signale les candidats à la migration |
| `check_docs_links.py` | valide le graphe `/docs` et les ancres laissées dans le code |

```bash
python3 tools/docs/audit_comments.py src/
python3 tools/docs/audit_comments.py src/core/ --json audit.json --max-ratio 0.15
python3 tools/docs/check_docs_links.py docs/ --src src/
python3 tools/docs/check_docs_links.py docs/ --src src/ --strict
```

## Ce que l'audit détecte

Bannières de section · code commenté · blocs de commentaire longs · JSDoc qui
ne fait que répéter les types · TODO sans propriétaire ni issue · ratio
commentaires/code par fichier · ancres `see: docs/...`

Le neutraliseur de chaînes évite les faux positifs sur les `//` dans les URLs.

## Ce que l'audit ne détecte pas

**Un commentaire qui paraphrase son code.** C'est un jugement sémantique, et
une heuristique produirait trop de faux positifs. C'est le travail de
`doc-keeper`, pas de l'outil.

## Ce que le vérificateur de liens détecte

Liens relatifs cassés · ancres de titre inexistantes · **wikilinks** (non
portables vers Notion) · documents orphelins · ancres `see: docs/...` dans le
code pointant vers un document ou un titre absent.

## Codes retour

`0` conforme, `1` échec. `--strict` fait échouer sur les warnings — pour la CI,
pas pour l'itération.

## Intégration CI suggérée

```yaml
- run: python3 tools/docs/check_docs_links.py docs/ --src src/
- run: python3 tools/docs/audit_comments.py src/ --max-ratio 0.20
```

Le second échoue sur du code commenté ou un fichier au-dessus du seuil. Le
seuil est une alerte de relecture, pas une cible : un fichier à 3 % peut être
parfait, et un fichier passé de 40 % à 5 % en supprimant trois avertissements
de piège est une régression.
