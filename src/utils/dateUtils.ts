// src/utils/dateUtils.ts

/**
 * Formats a date object, string, or number into a "Month Day, Year" string.
 * Example: "Jan 1, 2023"
 * @param date The date to format.
 * @returns A formatted date string or an empty string if the date is invalid.
 */
export const getFormattedDate = (date: string | number | Date | undefined | null): string => {
  if (!date) return "";
  try {
    return new Date(date).toLocaleDateString("en-GB", { // Changed to en-GB for consistency with other date formats
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch (error) {
    console.error("Error formatting date:", date, error);
    return ""; // Return empty for invalid dates
  }
};
