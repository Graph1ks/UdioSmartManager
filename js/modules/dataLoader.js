import { Logger } from "@/modules/logger.js";
// The DATA_SOURCE_URL import is now removed.

const logger = new Logger("DataLoader");

let promptGenData = {
  instruments: [],
  vocals: [],
  periods: [],
  productions: [],
  emotions: [],
  allNations: [],
  majorMusicNations: [],
  otherMusicNations: [],
  metaGenreCategories: {},
  periodToEraMap: {},
  allEras: [],
  strictlyModernGenreMarkers: [],
  genreEraTags: {},
  genreToSubgenresMap: {},
  periodToHistoricalRegionsMap: {},
  genreNationAffinity: {},
  modernElectronicInstruments: [],
  definitelyOldInstruments: [],
  classicalEraInstruments: [],
  romanticEraInstruments: [],
  modernVocalStyles: [],
  genres: [],
};
let isDataLoaded = false;
let dataLoadAttempted = false;

function processLoadedData(jsonData) {
  for (const key in jsonData) {
    if (jsonData.hasOwnProperty(key)) {
      promptGenData[key] = jsonData[key];
    }
  }

  if (
    promptGenData.metaGenreCategories &&
    promptGenData.metaGenreCategories.all &&
    Array.isArray(promptGenData.metaGenreCategories.all)
  ) {
    promptGenData.genres = [
      ...new Set(promptGenData.metaGenreCategories.all),
    ].sort();
  } else if (
    promptGenData.metaGenreCategories &&
    Object.keys(promptGenData.metaGenreCategories).length > 1
  ) {
    const allDerivedGenres = Object.values(promptGenData.metaGenreCategories)
      .filter(Array.isArray)
      .flat();
    promptGenData.metaGenreCategories.all = [...new Set(allDerivedGenres)];
    promptGenData.genres = [
      ...new Set(promptGenData.metaGenreCategories.all),
    ].sort();
  } else {
    promptGenData.genres = [];
  }

  const allNationsLoaded = Array.isArray(promptGenData.allNations)
    ? promptGenData.allNations
    : [];
  if (promptGenData.periodToHistoricalRegionsMap) {
    for (const era in promptGenData.periodToHistoricalRegionsMap) {
      if (
        Array.isArray(promptGenData.periodToHistoricalRegionsMap[era]) &&
        promptGenData.periodToHistoricalRegionsMap[era].length === 0 &&
        [
          "early20th",
          "mid20th",
          "late20th",
          "contemporary",
          "future",
          "any_broad",
          "any_broad_modern",
        ].includes(era)
      ) {
        promptGenData.periodToHistoricalRegionsMap[era] = [...allNationsLoaded];
      }
    }
  }

  if (promptGenData.genreNationAffinity) {
    for (const genre in promptGenData.genreNationAffinity) {
      if (
        Array.isArray(promptGenData.genreNationAffinity[genre]) &&
        promptGenData.genreNationAffinity[genre].length === 0 &&
        [
          "Rock",
          "Metal",
          "Pop",
          "Electronic",
          "Punk",
          "Folk",
          "Experimental",
          "Ambient",
          "Noise",
          "World Music",
        ].includes(genre)
      ) {
        promptGenData.genreNationAffinity[genre] = [...allNationsLoaded];
      }
    }
  }

  isDataLoaded = true;
  logger.log("Prompt generation data successfully loaded and processed.");
}

function useFallbackData() {
  logger.error("Data loading failed. Using empty fallback data.");
  Object.keys(promptGenData).forEach((key) => {
    if (Array.isArray(promptGenData[key])) promptGenData[key] = [];
    else if (
      typeof promptGenData[key] === "object" &&
      promptGenData[key] !== null &&
      key !== "metaGenreCategories"
    )
      promptGenData[key] = {};
    else if (key === "metaGenreCategories")
      promptGenData.metaGenreCategories = { all: [] };
  });
  promptGenData.genres = [];
  isDataLoaded = true;
}

export async function loadData() {
  if (isDataLoaded || dataLoadAttempted) {
    logger.log("Data already loaded or load was previously attempted.");
    return { promptGenData, isDataLoaded };
  }
  dataLoadAttempted = true;

  // Use the chrome runtime to get the internal URL of the data file.
  const localDataUrl = chrome.runtime.getURL("content/udio_prompt_data.json");

  try {
    logger.log(
      `Fetching prompt data from local extension file: ${localDataUrl}`
    );
    const response = await fetch(localDataUrl);

    if (!response.ok) {
      throw new Error(
        `Failed to fetch local data: ${response.status} ${response.statusText}`
      );
    }

    const jsonData = await response.json();
    processLoadedData(jsonData);
  } catch (error) {
    logger.error("Error fetching or parsing local data:", error);
    useFallbackData();
  }

  return { promptGenData, isDataLoaded };
}
