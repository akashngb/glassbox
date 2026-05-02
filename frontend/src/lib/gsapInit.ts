import { gsap } from 'gsap'
import { Observer } from 'gsap/Observer'
import { CustomEase } from 'gsap/CustomEase'

let initialized = false

export function initGsap(): void {
  if (initialized) return
  initialized = true

  gsap.registerPlugin(Observer, CustomEase)

  CustomEase.create('settle', '0.20, 0.80, 0.30, 1.05')
  CustomEase.create('dampen', '0.40, 0, 0.60, 1')
}
