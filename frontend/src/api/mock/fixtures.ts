import type { BloodGroup, Lang } from '../types'

export interface HospitalFixture {
  id: string
  name: string
  area: string
  city: string
  isSimulated: true
}

export interface CentreFixture {
  id: string
  name: string
  area: string
  city: string
  isSimulated: true
}

export interface DonorFixture {
  id: string
  alias: string
  bloodGroup: BloodGroup
  distanceKm: number
  lang: Lang
  area: string
  isSimulated: true
}

export const MOCK_HOSPITALS: HospitalFixture[] = [
  {
    id: 'hosp-sample-1',
    name: 'Sample General Hospital, Chennai',
    area: 'Adyar',
    city: 'Chennai',
    isSimulated: true,
  },
  {
    id: 'hosp-sample-2',
    name: 'Metropolitan Care Hospital, Chennai',
    area: 'Anna Nagar',
    city: 'Chennai',
    isSimulated: true,
  },
  {
    id: 'hosp-sample-3',
    name: 'Coastal District Hospital, Chennai',
    area: 'Mylapore',
    city: 'Chennai',
    isSimulated: true,
  },
]

export const MOCK_CENTRES: CentreFixture[] = [
  {
    id: 'centre-sample-1',
    name: 'Central Blood Bank, Egmore (Simulated)',
    area: 'Egmore',
    city: 'Chennai',
    isSimulated: true,
  },
  {
    id: 'centre-sample-2',
    name: 'Community Transfusion Centre (Simulated)',
    area: 'T. Nagar',
    city: 'Chennai',
    isSimulated: true,
  },
]

// 30 Simulated Donors with aliases Donor A1..Donor C10, mixed blood groups, distances 0.5 to 12.0 km
export const MOCK_DONORS: DonorFixture[] = [
  // Round 1 (A1 - A10)
  { id: 'donor-a1', alias: 'Donor A1', bloodGroup: 'O+', distanceKm: 1.2, lang: 'en', area: 'Adyar', isSimulated: true },
  { id: 'donor-a2', alias: 'Donor A2', bloodGroup: 'O+', distanceKm: 1.8, lang: 'ta', area: 'Besant Nagar', isSimulated: true },
  { id: 'donor-a3', alias: 'Donor A3', bloodGroup: 'O+', distanceKm: 2.4, lang: 'en', area: 'Thiruvanmiyur', isSimulated: true },
  { id: 'donor-a4', alias: 'Donor A4', bloodGroup: 'O+', distanceKm: 3.1, lang: 'ta', area: 'Kotturpuram', isSimulated: true },
  { id: 'donor-a5', alias: 'Donor A5', bloodGroup: 'O+', distanceKm: 3.5, lang: 'en', area: 'R.A. Puram', isSimulated: true },
  { id: 'donor-a6', alias: 'Donor A6', bloodGroup: 'A+', distanceKm: 4.2, lang: 'ta', area: 'Guindy', isSimulated: true },
  { id: 'donor-a7', alias: 'Donor A7', bloodGroup: 'O+', distanceKm: 2.1, lang: 'en', area: 'Adyar', isSimulated: true },
  { id: 'donor-a8', alias: 'Donor A8', bloodGroup: 'B+', distanceKm: 4.9, lang: 'ta', area: 'Saidapet', isSimulated: true },
  { id: 'donor-a9', alias: 'Donor A9', bloodGroup: 'AB+', distanceKm: 5.5, lang: 'en', area: 'Velachery', isSimulated: true },
  { id: 'donor-a10', alias: 'Donor A10', bloodGroup: 'O-', distanceKm: 6.0, lang: 'ta', area: 'Teynampet', isSimulated: true },

  // Round 2 (B1 - B10)
  { id: 'donor-b1', alias: 'Donor B1', bloodGroup: 'O+', distanceKm: 4.5, lang: 'en', area: 'Mylapore', isSimulated: true },
  { id: 'donor-b2', alias: 'Donor B2', bloodGroup: 'O+', distanceKm: 5.0, lang: 'ta', area: 'Alwarpet', isSimulated: true },
  { id: 'donor-b3', alias: 'Donor B3', bloodGroup: 'O+', distanceKm: 5.2, lang: 'en', area: 'Mandaveli', isSimulated: true },
  { id: 'donor-b4', alias: 'Donor B4', bloodGroup: 'O+', distanceKm: 5.8, lang: 'ta', area: 'Nandanam', isSimulated: true },
  { id: 'donor-b5', alias: 'Donor B5', bloodGroup: 'O+', distanceKm: 6.3, lang: 'en', area: 'T. Nagar', isSimulated: true },
  { id: 'donor-b6', alias: 'Donor B6', bloodGroup: 'B+', distanceKm: 6.8, lang: 'ta', area: 'Kodambakkam', isSimulated: true },
  { id: 'donor-b7', alias: 'Donor B7', bloodGroup: 'A+', distanceKm: 7.2, lang: 'en', area: 'Ashok Nagar', isSimulated: true },
  { id: 'donor-b8', alias: 'Donor B8', bloodGroup: 'A-', distanceKm: 7.9, lang: 'ta', area: 'Vadapalani', isSimulated: true },
  { id: 'donor-b9', alias: 'Donor B9', bloodGroup: 'B-', distanceKm: 8.3, lang: 'en', area: 'Nungambakkam', isSimulated: true },
  { id: 'donor-b10', alias: 'Donor B10', bloodGroup: 'O+', distanceKm: 8.7, lang: 'ta', area: 'Chetpet', isSimulated: true },

  // Round 3 (C1 - C10)
  { id: 'donor-c1', alias: 'Donor C1', bloodGroup: 'O+', distanceKm: 8.0, lang: 'en', area: 'Egmore', isSimulated: true },
  { id: 'donor-c2', alias: 'Donor C2', bloodGroup: 'O+', distanceKm: 8.5, lang: 'ta', area: 'Kilpauk', isSimulated: true },
  { id: 'donor-c3', alias: 'Donor C3', bloodGroup: 'O+', distanceKm: 9.1, lang: 'en', area: 'Anna Nagar', isSimulated: true },
  { id: 'donor-c4', alias: 'Donor C4', bloodGroup: 'O+', distanceKm: 9.5, lang: 'ta', area: 'Shenoy Nagar', isSimulated: true },
  { id: 'donor-c5', alias: 'Donor C5', bloodGroup: 'O+', distanceKm: 10.1, lang: 'en', area: 'Aminjikarai', isSimulated: true },
  { id: 'donor-c6', alias: 'Donor C6', bloodGroup: 'AB-', distanceKm: 10.6, lang: 'ta', area: 'Purasawalkam', isSimulated: true },
  { id: 'donor-c7', alias: 'Donor C7', bloodGroup: 'B+', distanceKm: 11.0, lang: 'en', area: 'Perambur', isSimulated: true },
  { id: 'donor-c8', alias: 'Donor C8', bloodGroup: 'A+', distanceKm: 11.4, lang: 'ta', area: 'Ayanavaram', isSimulated: true },
  { id: 'donor-c9', alias: 'Donor C9', bloodGroup: 'O-', distanceKm: 11.8, lang: 'en', area: 'Villivakkam', isSimulated: true },
  { id: 'donor-c10', alias: 'Donor C10', bloodGroup: 'O+', distanceKm: 12.0, lang: 'ta', area: 'Kolathur', isSimulated: true },
]
