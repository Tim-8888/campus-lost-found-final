export function displayCategoryName(name: string): string {
  return name.trim().toLowerCase() === 'clothing' ? 'Clothes' : name
}
