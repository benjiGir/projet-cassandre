import { assetUrl } from "../../../core/loading/assetPath";
import { fetchJson } from "../../../core/net/fetchJson";
import { LEVEL_CHOICES } from "../catalog/levels";
import { decodeLevelSpacesManifest, type LevelSpaceData } from "../navigation/levelSpaces";

/**
 * Espaces du plan de masse du niveau `gltfName`, non triés. `null` si le
 * niveau n'en déclare pas (`LevelDef.spaces`) ou si le manifeste est
 * illisible : le niveau reste jouable, sans répliques de lieu.
 */
export async function loadLevelSpaces(gltfName: string): Promise<LevelSpaceData[] | null> {
  if (!LEVEL_CHOICES.some((level) => level.gltfName === gltfName && level.spaces)) return null;
  const url = assetUrl(`assets/levels/${gltfName}.espaces.json`);
  try {
    return [...(await fetchJson(url, decodeLevelSpacesManifest)).espaces];
  } catch (error) {
    console.warn(`[level] manifeste des espaces illisible ("${url}" : ${error}) — pas de répliques de lieu.`);
    return null;
  }
}
