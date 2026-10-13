import type { BloodGroup, Component } from '../api/types'

export function maskPhone(phone: string): string {
  if (phone.length <= 4) return '••••'
  return `•••• ••${phone.slice(-4)}`
}

export function formatBloodGroup(bg: BloodGroup): string {
  return bg
}

export function formatComponent(comp: Component): string {
  switch (comp) {
    case 'WHOLE_BLOOD':
      return 'Whole Blood'
    case 'RED_CELLS':
      return 'Packed Red Blood Cells'
    case 'PLATELETS_SDP':
      return 'Single Donor Platelets (SDP)'
    case 'PLATELETS_RDP':
      return 'Random Donor Platelets (RDP)'
    case 'PLASMA':
      return 'Fresh Frozen Plasma'
    case 'UNSPECIFIED':
      return 'Unspecified Component'
  }
}
