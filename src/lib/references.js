// Pasand ki photo -> pose: body points nikalo aur photo ke saath save karo.
// Photos tab aur Camera ki pose sheet, dono yahi use karte hain.
import { referencesDb, newId } from './db'
import { detectPoseInImage } from './poseDetector'
import { poseFromLandmarks } from './poses'
import { loadImage } from './image'

// credit: optional (Pexels photo ho toh photographer ka naam + link)
export async function addReferencePhotos(urls, credit = null) {
  let list = await referencesDb.load()
  let found = 0
  let lastId = null
  for (const image of urls) {
    let pose = null
    try {
      const img = await loadImage(image)
      const lm = await detectPoseInImage(img)
      if (lm) { pose = poseFromLandmarks(lm, img.width, img.height); found++ }
    } catch (e) {
      console.warn('pose detect fail', e) // pose na mile toh bhi photo taste ke liye kaam aayegi
    }
    lastId = newId()
    list = await referencesDb.add({ id: lastId, image, pose, credit, addedAt: Date.now() })
  }
  return { list, found, lastId }
}
