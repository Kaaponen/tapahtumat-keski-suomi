/** "Paviljonki – Encore-sali" -> "Paviljonki" */
export function mainVenue(venue?: string): string | undefined {
  return venue?.split(' – ')[0].trim();
}
