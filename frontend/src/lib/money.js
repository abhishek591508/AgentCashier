export const rupees = (paise) =>
  `₹${(Number(paise || 0) / 100).toFixed(2)}`;
