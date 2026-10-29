// MediaPipe Pose: phone ke andar hi (bina internet ke AI call) body ke 33 points dhoondta hai.
// Yahi live camera mein tumhara skeleton track karta hai.
import { FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision'

const WASM = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.2.0/wasm'
const MODEL = {
  lite: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task',
  full: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/latest/pose_landmarker_full.task',
}

let filesetPromise = null
const cache = {}

// Ek hi baar load karo, baad mein wahi object reuse karo (load hone mein 2-5 sec lagte hain).
function getLandmarker(mode) {
  if (!cache[mode]) {
    filesetPromise ||= FilesetResolver.forVisionTasks(WASM)
    cache[mode] = filesetPromise.then((fileset) =>
      PoseLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: mode === 'VIDEO' ? MODEL.lite : MODEL.full, delegate: 'GPU' },
        runningMode: mode,
        numPoses: 1,
      }),
    )
  }
  return cache[mode]
}

export const getVideoLandmarker = () => getLandmarker('VIDEO')

// Ek photo se landmarks (pasand ki photos ka pose nikalne ke liye)
export async function detectPoseInImage(imgEl) {
  const lm = await getLandmarker('IMAGE')
  const res = lm.detect(imgEl)
  return res.landmarks?.[0] || null
}
