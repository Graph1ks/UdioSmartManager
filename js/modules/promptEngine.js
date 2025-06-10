// js/modules/promptEngine.js

// This file contains pure data-driven logic for prompt generation.
// It is kept separate from UI concerns.

// These constants are only used by this engine, so they live here now.
const STRONG_AFFINITY_NATION_PROBABILITY = 0.9;
const MAJOR_NATION_PROBABILITY = 0.85;

export function getRandomElement(arr, count = 1) {
  if (!arr || arr.length === 0) {
    return count === 1 ? "" : [];
  }
  if (count === 1) {
    return arr[Math.floor(Math.random() * arr.length)];
  }
  const shuffled = [...arr].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, Math.min(count, arr.length));
}

export function getRandomElementExcluding(arr, exclude) {
  if (!arr || arr.length === 0) return "";
  const filteredArr = arr.filter((item) => item !== exclude);
  if (filteredArr.length === 0 && arr.length > 0) return getRandomElement(arr);
  if (filteredArr.length === 0 && arr.length === 0) return "";
  return getRandomElement(filteredArr);
}

export function getEraForPeriod(period, promptGenData) {
  return promptGenData.periodToEraMap[period] || "contemporary";
}

export function isGenreStrictlyModern(genreName, promptGenData) {
  if (!genreName) return false;
  const lowerGenre = genreName.toLowerCase();
  if (
    promptGenData.strictlyModernGenreMarkers &&
    promptGenData.strictlyModernGenreMarkers.some((marker) =>
      lowerGenre.includes(marker.toLowerCase())
    )
  ) {
    return true;
  }
  if (
    (promptGenData.metaGenreCategories.Electronic &&
      promptGenData.metaGenreCategories.Electronic.includes(genreName)) ||
    (promptGenData.metaGenreCategories.HipHop &&
      promptGenData.metaGenreCategories.HipHop.includes(genreName))
  ) {
    if (
      !genreName.toLowerCase().includes("jazz") &&
      !genreName.toLowerCase().includes("swing") &&
      !genreName.toLowerCase().includes("folk") &&
      !genreName.toLowerCase().includes("classical") &&
      !genreName.toLowerCase().includes("ambient") &&
      !genreName.toLowerCase().includes("lounge") &&
      !genreName.toLowerCase().includes("experimental") &&
      !genreName.toLowerCase().includes("disco")
    ) {
      return true;
    }
  }
  return false;
}

export function getTypicalErasForGenre(genreName, promptGenData) {
  if (promptGenData.genreEraTags[genreName]) {
    const specificEras = promptGenData.genreEraTags[genreName].filter(
      (era) => era !== "any_broad" && era !== "any_broad_modern"
    );
    if (specificEras.length > 0) return specificEras;
    return promptGenData.genreEraTags[genreName];
  }
  if (isGenreStrictlyModern(genreName, promptGenData))
    return ["contemporary", "late20th", "future"];
  const modernDefaults = ["contemporary", "late20th", "mid20th", "early20th"];
  const historicalDefaults = [
    "romantic",
    "classical",
    "baroque",
    "renaissance",
    "medieval",
  ];
  if (
    (promptGenData.metaGenreCategories.Electronic &&
      promptGenData.metaGenreCategories.Electronic.includes(genreName)) ||
    (promptGenData.metaGenreCategories.HipHop &&
      promptGenData.metaGenreCategories.HipHop.includes(genreName)) ||
    (promptGenData.metaGenreCategories.Pop &&
      promptGenData.metaGenreCategories.Pop.includes(genreName)) ||
    (promptGenData.metaGenreCategories.Metal &&
      promptGenData.metaGenreCategories.Metal.includes(genreName)) ||
    (promptGenData.metaGenreCategories.Punk &&
      promptGenData.metaGenreCategories.Punk.includes(genreName))
  ) {
    return modernDefaults.slice(0, 2);
  }
  if (
    (promptGenData.metaGenreCategories.Rock &&
      promptGenData.metaGenreCategories.Rock.includes(genreName)) ||
    (promptGenData.metaGenreCategories.RnBSoulFunk &&
      promptGenData.metaGenreCategories.RnBSoulFunk.includes(genreName)) ||
    (promptGenData.metaGenreCategories.Jazz &&
      promptGenData.metaGenreCategories.Jazz.includes(genreName))
  ) {
    return modernDefaults;
  }
  if (
    (promptGenData.metaGenreCategories.ClassicalMusic &&
      promptGenData.metaGenreCategories.ClassicalMusic.includes(genreName)) ||
    genreName.toLowerCase().includes("baroque") ||
    genreName.toLowerCase().includes("classical") ||
    genreName.toLowerCase().includes("romantic") ||
    genreName.toLowerCase().includes("renaissance") ||
    genreName.toLowerCase().includes("medieval")
  ) {
    if (genreName.toLowerCase().includes("medieval")) return ["medieval"];
    if (genreName.toLowerCase().includes("renaissance")) return ["renaissance"];
    if (genreName.toLowerCase().includes("baroque")) return ["baroque"];
    if (
      genreName.toLowerCase().includes("classical") &&
      !genreName.toLowerCase().includes("modern") &&
      !genreName.toLowerCase().includes("neo")
    )
      return ["classical", "romantic"];
    return historicalDefaults;
  }
  if (
    (promptGenData.metaGenreCategories.Folk &&
      promptGenData.metaGenreCategories.Folk.includes(genreName)) ||
    (promptGenData.metaGenreCategories.BluesCountry &&
      promptGenData.metaGenreCategories.BluesCountry.includes(genreName)) ||
    (promptGenData.metaGenreCategories.WorldLatinReggae &&
      promptGenData.metaGenreCategories.WorldLatinReggae.includes(genreName))
  ) {
    return ["any_broad", ...modernDefaults];
  }
  return ["contemporary", "late20th"];
}

export function selectBestEraFromList(
  typicalEras,
  isStrictlyModern,
  genreName = ""
) {
  if (!typicalEras || typicalEras.length === 0) return "contemporary";
  let possibleEras = [...typicalEras];
  if (isStrictlyModern) {
    possibleEras = possibleEras.filter((era) =>
      [
        "contemporary",
        "late20th",
        "mid20th",
        "future",
        "any_broad_modern",
      ].includes(era)
    );
    if (
      genreName.toLowerCase().includes("grime") ||
      genreName.toLowerCase().includes("drill") ||
      genreName.toLowerCase().includes("phonk") ||
      genreName.toLowerCase().includes("hyperpop") ||
      genreName.toLowerCase().includes("dubstep") ||
      genreName.toLowerCase().includes("future bass") ||
      genreName.toLowerCase().includes("future garage") ||
      genreName.toLowerCase().includes("future house")
    ) {
      possibleEras = possibleEras.filter((era) =>
        ["contemporary", "future"].includes(era)
      );
    } else if (
      genreName.toLowerCase().includes("trap") ||
      genreName.toLowerCase().includes("edm") ||
      genreName.toLowerCase().includes("synthwave") ||
      genreName.toLowerCase().includes("vaporwave") ||
      genreName.toLowerCase().includes("lo-fi hip hop")
    ) {
      possibleEras = possibleEras.filter((era) =>
        ["contemporary", "late20th", "future"].includes(era)
      );
    }
    if (possibleEras.length === 0) return "contemporary";
  } else {
    const historicalSpecific = possibleEras.filter((era) =>
      [
        "ancient",
        "medieval",
        "renaissance",
        "baroque",
        "classical",
        "romantic",
      ].includes(era)
    );
    if (historicalSpecific.length > 0) {
      return getRandomElement(historicalSpecific);
    }
  }
  if (possibleEras.includes("any_broad_modern") && !isStrictlyModern) {
    const modernSpecific = possibleEras.filter((era) =>
      ["contemporary", "late20th", "mid20th", "early20th"].includes(era)
    );
    if (modernSpecific.length > 0) return getRandomElement(modernSpecific);
  }
  if (possibleEras.includes("any_broad")) {
    const nonBroad = possibleEras.filter(
      (era) => era !== "any_broad" && era !== "any_broad_modern"
    );
    if (nonBroad.length > 0) return getRandomElement(nonBroad);
    return getRandomElement(["contemporary", "late20th", "mid20th"]);
  }
  if (possibleEras.length > 0) {
    if (possibleEras.includes("contemporary")) return "contemporary";
    if (possibleEras.includes("future")) return "future";
    if (possibleEras.includes("late20th")) return "late20th";
    if (possibleEras.includes("mid20th")) return "mid20th";
    if (possibleEras.includes("early20th")) return "early20th";
    return getRandomElement(possibleEras);
  }
  return "contemporary";
}

export function getSensibleDisplayPeriodForEra(
  effectiveEra,
  promptGenData,
  primaryGenreContext = ""
) {
  let suitablePeriods = [];
  const historicalEras = [
    "ancient",
    "medieval",
    "renaissance",
    "baroque",
    "classical",
    "romantic",
  ];
  const modernEras = [
    "early20th",
    "mid20th",
    "late20th",
    "contemporary",
    "future",
  ];
  if (historicalEras.includes(effectiveEra)) {
    suitablePeriods = promptGenData.periods.filter((p) => {
      const pEra = getEraForPeriod(p, promptGenData);
      return (
        pEra === effectiveEra &&
        (isNaN(parseInt(p.substring(0, 4))) ||
          p.toLowerCase().includes("century") ||
          p.toLowerCase().includes("age") ||
          p.toLowerCase().includes("period") ||
          p.toLowerCase() === effectiveEra ||
          p.toLowerCase() === effectiveEra + " era" ||
          p.toLowerCase() === effectiveEra + " period")
      );
    });
    if (
      primaryGenreContext &&
      getEraForPeriod(primaryGenreContext, promptGenData) === effectiveEra &&
      promptGenData.periods.includes(primaryGenreContext)
    ) {
      return primaryGenreContext;
    }
    if (suitablePeriods.length === 0) {
      suitablePeriods = promptGenData.periods.filter(
        (p) => getEraForPeriod(p, promptGenData) === effectiveEra
      );
    }
    if (suitablePeriods.length === 0) {
      const eraName =
        effectiveEra.charAt(0).toUpperCase() + effectiveEra.slice(1);
      if (promptGenData.periods.includes(eraName)) return eraName;
      return eraName + " Era";
    }
  } else if (modernEras.includes(effectiveEra)) {
    suitablePeriods = promptGenData.periods.filter((p) => {
      const pEra = getEraForPeriod(p, promptGenData);
      return pEra === effectiveEra && /^\d{4}s$/.test(p);
    });
    if (
      suitablePeriods.length === 0 &&
      (effectiveEra === "contemporary" || effectiveEra === "future")
    ) {
      const directTerm = promptGenData.periods.find(
        (p) => p.toLowerCase() === effectiveEra.toLowerCase()
      );
      if (directTerm) suitablePeriods.push(directTerm);
    }
    if (suitablePeriods.length === 0) {
      let fallbackDecade = "2020s";
      if (effectiveEra === "late20th")
        fallbackDecade = getRandomElement(["1980s", "1990s"]);
      else if (effectiveEra === "mid20th")
        fallbackDecade = getRandomElement(["1950s", "1960s", "1970s"]);
      else if (effectiveEra === "early20th")
        fallbackDecade = getRandomElement([
          "1900s",
          "1910s",
          "1920s",
          "1930s",
          "1940s",
        ]);
      else if (effectiveEra === "contemporary")
        fallbackDecade = getRandomElement([
          "2000s",
          "2010s",
          "2020s",
          "Contemporary",
        ]);
      else if (effectiveEra === "future")
        fallbackDecade = getRandomElement(["2030s", "2040s", "Future"]);
      if (promptGenData.periods.includes(fallbackDecade))
        suitablePeriods.push(fallbackDecade);
      else return fallbackDecade;
    }
  } else {
    suitablePeriods = promptGenData.periods.filter(
      (p) => /^\d{4}s$/.test(p) || p === "Contemporary" || p === "Future"
    );
    if (suitablePeriods.length === 0)
      suitablePeriods = ["2020s", "1990s", "1970s"];
  }
  if (suitablePeriods.length > 0) {
    return getRandomElement(suitablePeriods);
  }
  return effectiveEra === "contemporary"
    ? "Contemporary"
    : effectiveEra.endsWith("s")
    ? effectiveEra
    : "2020s";
}

export function isGenreCompatibleWithEra(genreName, era, promptGenData) {
  const genreIsStrictlyModern = isGenreStrictlyModern(genreName, promptGenData);
  if (
    genreIsStrictlyModern &&
    [
      "ancient",
      "medieval",
      "renaissance",
      "baroque",
      "classical",
      "romantic",
    ].includes(era)
  ) {
    return false;
  }
  const tags = getTypicalErasForGenre(genreName, promptGenData);
  if (tags) {
    if (tags.includes(era)) return true;
    if (tags.includes("any_broad")) return true;
    if (
      tags.includes("any_broad_modern") &&
      ![
        "ancient",
        "medieval",
        "renaissance",
        "baroque",
        "classical",
        "romantic",
      ].includes(era)
    )
      return true;
    return false;
  }
  if (
    [
      "ancient",
      "medieval",
      "renaissance",
      "baroque",
      "classical",
      "romantic",
    ].includes(era)
  ) {
    return !genreIsStrictlyModern;
  }
  return true;
}

export function getGenresForEra(
  era,
  promptGenData,
  selectedGenreCategory = "all",
  strictCategoryNoFallbackToAll = false
) {
  let baseGenresSource;
  if (
    selectedGenreCategory !== "all" &&
    promptGenData.metaGenreCategories[selectedGenreCategory] &&
    promptGenData.metaGenreCategories[selectedGenreCategory].length > 0
  ) {
    baseGenresSource = promptGenData.metaGenreCategories[selectedGenreCategory];
  } else {
    baseGenresSource = promptGenData.genres;
  }
  let suitableGenres = baseGenresSource.filter((genre) => {
    const genreIsStrictlyModern = isGenreStrictlyModern(genre, promptGenData);
    if (
      genreIsStrictlyModern &&
      [
        "ancient",
        "medieval",
        "renaissance",
        "baroque",
        "classical",
        "romantic",
      ].includes(era)
    ) {
      return false;
    }
    const tags = getTypicalErasForGenre(genre, promptGenData);
    if (tags) {
      if (tags.includes(era)) return true;
      if (tags.includes("any_broad")) return true;
      if (
        tags.includes("any_broad_modern") &&
        ![
          "ancient",
          "medieval",
          "renaissance",
          "baroque",
          "classical",
          "romantic",
        ].includes(era)
      )
        return true;
      return false;
    }
    if (
      [
        "ancient",
        "medieval",
        "renaissance",
        "baroque",
        "classical",
        "romantic",
      ].includes(era)
    ) {
      return false;
    }
    return true;
  });
  if (suitableGenres.length === 0) {
    if (strictCategoryNoFallbackToAll && selectedGenreCategory !== "all") {
      return [];
    }
    if (selectedGenreCategory !== "all") {
      const allGenresForEra = getGenresForEra(era, promptGenData, "all", true);
      if (allGenresForEra.length > 0) return allGenresForEra;
    }
    if (
      [
        "contemporary",
        "late20th",
        "mid20th",
        "early20th",
        "future",
        "any_broad_modern",
      ].includes(era)
    ) {
      const fallbackSource =
        promptGenData.metaGenreCategories[selectedGenreCategory] &&
        promptGenData.metaGenreCategories[selectedGenreCategory].length > 0
          ? promptGenData.metaGenreCategories[selectedGenreCategory]
          : promptGenData.genres;
      const modernEras = [
        "contemporary",
        "late20th",
        "mid20th",
        "early20th",
        "future",
        "any_broad_modern",
      ];
      return fallbackSource.filter(
        (g) =>
          !isGenreStrictlyModern(g, promptGenData) || modernEras.includes(era)
      );
    }
    return [];
  }
  return suitableGenres;
}

export function getAffinityNationsForPromptGen(
  primaryGenre,
  currentEra,
  promptGenData
) {
  let genreSpecificAffinities = [];
  if (
    primaryGenre &&
    promptGenData.genreNationAffinity &&
    promptGenData.genreNationAffinity[primaryGenre]
  ) {
    genreSpecificAffinities = promptGenData.genreNationAffinity[
      primaryGenre
    ].filter(
      (n) =>
        typeof n === "string" &&
        (promptGenData.allNations.includes(n) ||
          (promptGenData.periodToHistoricalRegionsMap[currentEra] &&
            promptGenData.periodToHistoricalRegionsMap[currentEra].includes(n)))
    );
  } else if (primaryGenre && promptGenData.genreNationAffinity) {
    const genreLower = primaryGenre.toLowerCase();
    for (const key in promptGenData.genreNationAffinity) {
      if (
        genreLower.includes(key.toLowerCase()) &&
        promptGenData.genreNationAffinity[key] &&
        promptGenData.genreNationAffinity[key].length > 0
      ) {
        genreSpecificAffinities = promptGenData.genreNationAffinity[key].filter(
          (n) =>
            typeof n === "string" &&
            (promptGenData.allNations.includes(n) ||
              (promptGenData.periodToHistoricalRegionsMap[currentEra] &&
                promptGenData.periodToHistoricalRegionsMap[currentEra].includes(
                  n
                )))
        );
        if (genreSpecificAffinities.length > 0) break;
      }
    }
  }
  let historicalContextRegionsOrNations =
    (promptGenData.periodToHistoricalRegionsMap &&
      promptGenData.periodToHistoricalRegionsMap[currentEra]) ||
    promptGenData.allNations;
  let nationPool = [];
  if (
    genreSpecificAffinities.length > 0 &&
    Math.random() < STRONG_AFFINITY_NATION_PROBABILITY
  ) {
    const affinityInContext = genreSpecificAffinities.filter((n) => {
      if (historicalContextRegionsOrNations === promptGenData.allNations)
        return true;
      return (
        historicalContextRegionsOrNations.includes(n) ||
        promptGenData.allNations.includes(n)
      );
    });
    if (affinityInContext.length > 0) {
      nationPool = affinityInContext;
    }
  }
  if (nationPool.length === 0) {
    if (genreSpecificAffinities.length > 0) {
      const affinityInContext = genreSpecificAffinities.filter((n) => {
        if (historicalContextRegionsOrNations === promptGenData.allNations)
          return true;
        return (
          historicalContextRegionsOrNations.includes(n) ||
          promptGenData.allNations.includes(n)
        );
      });
      if (affinityInContext.length > 0) nationPool = affinityInContext;
      else nationPool = historicalContextRegionsOrNations;
    } else {
      nationPool = historicalContextRegionsOrNations;
    }
  }
  let potentialModernNations = [];
  if (
    !["ancient", "medieval", "renaissance"].includes(currentEra) ||
    nationPool.every((n) => promptGenData.allNations.includes(n))
  ) {
    potentialModernNations = nationPool
      .map((regionOrNation) => {
        if (promptGenData.allNations.includes(regionOrNation))
          return regionOrNation;
        for (const modernNation of promptGenData.allNations) {
          if (regionOrNation.toLowerCase().includes(modernNation.toLowerCase()))
            return modernNation;
        }
        return null;
      })
      .filter((n) => n !== null);
  }
  if (potentialModernNations.length > 0) {
    nationPool = [...new Set(potentialModernNations)];
  } else if (
    nationPool.some((n) => !promptGenData.allNations.includes(n)) &&
    ["ancient", "medieval", "renaissance", "baroque"].includes(currentEra)
  ) {
    const historicalOnly = nationPool.filter(
      (n) => !promptGenData.allNations.includes(n)
    );
    if (historicalOnly.length > 0) return getRandomElement(historicalOnly);
  }
  if (
    nationPool.length === 0 ||
    nationPool.every(
      (n) =>
        !promptGenData.allNations.includes(n) &&
        !["ancient", "medieval", "renaissance", "baroque"].includes(currentEra)
    )
  ) {
    nationPool = [...promptGenData.allNations];
  } else {
    const modernNationsInPool = nationPool.filter((n) =>
      promptGenData.allNations.includes(n)
    );
    if (modernNationsInPool.length > 0) {
      nationPool = modernNationsInPool;
    } else if (
      !["ancient", "medieval", "renaissance", "baroque"].includes(currentEra)
    ) {
      nationPool = [...promptGenData.allNations];
    } else if (
      nationPool.filter((n) => !promptGenData.allNations.includes(n)).length > 0
    ) {
      return getRandomElement(
        nationPool.filter((n) => !promptGenData.allNations.includes(n))
      );
    } else {
      nationPool = [...promptGenData.allNations];
    }
  }
  if (
    [
      "mid20th",
      "late20th",
      "contemporary",
      "future",
      "any_broad_modern",
      "early20th",
    ].includes(currentEra) &&
    nationPool.filter((n) => promptGenData.allNations.includes(n)).length > 3
  ) {
    let modernNationChoices = nationPool.filter((n) =>
      promptGenData.allNations.includes(n)
    );
    let majorNationsInPool = modernNationChoices.filter((n) =>
      promptGenData.majorMusicNations.includes(n)
    );
    let otherNationsInPool = modernNationChoices.filter(
      (n) =>
        promptGenData.otherMusicNations.includes(n) &&
        !promptGenData.majorMusicNations.includes(n)
    );
    if (
      Math.random() < MAJOR_NATION_PROBABILITY &&
      majorNationsInPool.length > 0
    ) {
      nationPool = majorNationsInPool;
    } else if (otherNationsInPool.length > 0) {
      nationPool = otherNationsInPool;
    } else if (majorNationsInPool.length > 0) {
      nationPool = majorNationsInPool;
    } else {
      nationPool = modernNationChoices;
    }
  }
  if (nationPool.length === 0)
    return getRandomElement(promptGenData.allNations);
  return getRandomElement([
    ...new Set(nationPool.filter((n) => typeof n === "string" && n.length > 0)),
  ]);
}

export function isInstrumentCompatibleWithPeriod(
  instrument,
  periodOrEraString,
  promptGenData
) {
  let era;
  if (promptGenData.allEras.includes(periodOrEraString)) {
    era = periodOrEraString;
  } else if (promptGenData.periodToEraMap[periodOrEraString]) {
    era = getEraForPeriod(periodOrEraString, promptGenData);
  } else {
    era = "contemporary";
    if (
      typeof periodOrEraString === "string" &&
      periodOrEraString.endsWith("s") &&
      !isNaN(parseInt(periodOrEraString.substring(0, 4)))
    ) {
      const year = parseInt(periodOrEraString.substring(0, 4));
      if (year >= 2030) era = "future";
      else if (year >= 2000) era = "contemporary";
      else if (year >= 1980) era = "late20th";
      else if (year >= 1950) era = "mid20th";
      else if (year >= 1900) era = "early20th";
      else if (year >= 1800) era = "romantic";
      else if (year >= 1700) era = "classical";
      else if (year >= 1600) era = "baroque";
    }
  }
  const instLower = instrument.toLowerCase();
  const historicalEras = [
    "ancient",
    "medieval",
    "renaissance",
    "baroque",
    "classical",
    "romantic",
  ];
  const veryOldEras = ["ancient", "medieval", "renaissance"];
  if (
    promptGenData.modernElectronicInstruments.some((modInst) =>
      instLower.includes(modInst.toLowerCase())
    )
  ) {
    if (instLower.includes("theremin") || instLower.includes("ondes martenot"))
      return [
        "early20th",
        "mid20th",
        "late20th",
        "contemporary",
        "future",
        "any_broad_modern",
      ].includes(era);
    if (
      instLower.includes("hammond organ") ||
      (instLower.includes("electric organ") &&
        !instLower.includes("portative") &&
        !instLower.includes("reed"))
    )
      return [
        "early20th",
        "mid20th",
        "late20th",
        "contemporary",
        "future",
        "any_broad_modern",
      ].includes(era);
    if (instLower.includes("mellotron"))
      return [
        "mid20th",
        "late20th",
        "contemporary",
        "future",
        "any_broad_modern",
      ].includes(era);
    if (
      [
        "synthesizer",
        "sampler",
        "drum machine",
        "sequencer",
        "vocoder",
        "arpeggiator",
        "modular",
        "analog synth",
        "digital synth",
        "fm synth",
        "wavetable",
        "granular synth",
        "chiptune",
        "circuit bent",
        "glitch sounds",
        "moog",
      ].some((s) => instLower.includes(s))
    ) {
      if (
        era === "mid20th" &&
        (instLower.includes("synthesizer") ||
          instLower.includes("sampler") ||
          instLower.includes("drum machine"))
      )
        return true;
      return [
        "late20th",
        "contemporary",
        "future",
        "any_broad_modern",
      ].includes(era);
    }
    if (
      [
        "808",
        "909",
        "linndrum",
        "sp-1200",
        "synth pad",
        "synth lead",
        "synth bass",
        "sub bass",
        "synth strings",
        "synth brass",
      ].some((s) => instLower.includes(s))
    ) {
      return [
        "late20th",
        "contemporary",
        "future",
        "any_broad_modern",
      ].includes(era);
    }
    if (instLower.includes("turntables") || instLower.includes("talk box"))
      return [
        "late20th",
        "contemporary",
        "future",
        "any_broad_modern",
      ].includes(era);
    if (instLower.includes("laser harp") || instLower.includes("stylophone"))
      return [
        "late20th",
        "contemporary",
        "future",
        "any_broad_modern",
      ].includes(era);
    return false;
  }
  if (
    promptGenData.definitelyOldInstruments.some((oldInst) =>
      instLower.includes(oldInst.toLowerCase())
    )
  ) {
    if (instLower.includes("harpsichord") || instLower.includes("clavichord"))
      return ["renaissance", "baroque", "classical"].includes(era);
    if (
      instLower.includes("lute") ||
      instLower.includes("theorbo") ||
      instLower.includes("archlute")
    )
      return ["renaissance", "baroque"].includes(era);
    if (instLower.includes("viola da gamba"))
      return ["renaissance", "baroque", "classical"].includes(era);
    if (
      instLower.includes("recorder") &&
      !instLower.includes("alto") &&
      !instLower.includes("bass")
    )
      return !["contemporary", "future", "late20th", "mid20th"].includes(era);
    return veryOldEras.includes(era) || era === "baroque";
  }
  if (
    instLower.includes("electric guitar") ||
    instLower.includes("electric bass guitar") ||
    (instLower.includes("bass guitar") && !instLower.includes("acoustic"))
  ) {
    return [
      "mid20th",
      "late20th",
      "contemporary",
      "future",
      "any_broad_modern",
    ].includes(era);
  }
  if (instLower.includes("drum kit"))
    return [
      "early20th",
      "mid20th",
      "late20th",
      "contemporary",
      "future",
      "any_broad_modern",
    ].includes(era);
  if (
    instLower.includes("piano") &&
    !instLower.includes("electric") &&
    !instLower.includes("thumb") &&
    !instLower.includes("upright")
  ) {
    return (
      [
        "classical",
        "romantic",
        "early20th",
        "mid20th",
        "late20th",
        "contemporary",
        "future",
        "any_broad",
        "any_broad_modern",
      ].includes(era) &&
      era !== "baroque" &&
      era !== "renaissance" &&
      era !== "medieval" &&
      era !== "ancient"
    );
  }
  if (instLower.includes("upright piano"))
    return [
      "romantic",
      "early20th",
      "mid20th",
      "late20th",
      "contemporary",
      "future",
      "any_broad",
      "any_broad_modern",
    ].includes(era);
  if (instLower.includes("electric piano"))
    return [
      "mid20th",
      "late20th",
      "contemporary",
      "future",
      "any_broad_modern",
    ].includes(era);
  if (
    instLower.includes("clarinet") &&
    !instLower.includes("alto") &&
    !instLower.includes("bass")
  )
    return !["ancient", "medieval", "renaissance", "baroque"].includes(era);
  if (instLower.includes("saxophone"))
    return ![
      "ancient",
      "medieval",
      "renaissance",
      "baroque",
      "classical",
    ].includes(era);
  if (instLower.includes("tuba"))
    return ![
      "ancient",
      "medieval",
      "renaissance",
      "baroque",
      "classical",
    ].includes(era);
  if (
    instLower.includes("violin") ||
    instLower.includes("viola") ||
    instLower.includes("cello") ||
    (instLower.includes("double bass") && !instLower.includes("electric"))
  ) {
    return !["ancient", "medieval", "renaissance"].includes(era);
  }
  if (
    instLower.includes("flute") &&
    !instLower.includes("alto") &&
    !instLower.includes("bass") &&
    !instLower.includes("pan") &&
    !instLower.includes("nose") &&
    !instLower.includes("recorder")
  ) {
    return !["ancient", "medieval"].includes(era);
  }
  if (era === "any_broad" || era === "any_broad_modern") return true;
  const commonFolkInstruments = [
    "acoustic guitar",
    "fiddle",
    "banjo",
    "mandolin",
    "accordion",
    "harmonica",
    "bodhrán",
    "whistle",
    "bouzouki",
    "oud",
    "sitar",
    "tabla",
    "didgeridoo",
    "bagpipes",
    "dombra",
  ];
  if (commonFolkInstruments.some((folkInst) => instLower.includes(folkInst))) {
    if (
      instLower.includes("banjo") ||
      instLower.includes("accordion") ||
      instLower.includes("harmonica") ||
      instLower.includes("concertina")
    ) {
      return ![
        "ancient",
        "medieval",
        "renaissance",
        "baroque",
        "classical",
      ].includes(era);
    }
    return (
      !["ancient"].includes(era) ||
      instLower.includes("oud") ||
      instLower.includes("harp") ||
      instLower.includes("lyre") ||
      instLower.includes("frame drum")
    );
  }
  if (historicalEras.includes(era)) {
    const allowedForHistorical = [
      "vocals",
      "percussion",
      "hand drum",
      "frame drum",
      "tambourine",
      "harp",
      "lyre",
      "oud",
      "bells",
      "chimes",
      "cymbals",
      "horns",
      "bullroarer",
      "pipe organ",
      "classical guitar",
      "acoustic guitar",
    ];
    if (allowedForHistorical.some((histInst) => instLower.includes(histInst)))
      return true;
    return false;
  }
  return true;
}

export function getCompatibleInstruments(periodOrEraString, promptGenData) {
  let era;
  if (promptGenData.allEras.includes(periodOrEraString)) {
    era = periodOrEraString;
  } else if (promptGenData.periodToEraMap[periodOrEraString]) {
    era = getEraForPeriod(periodOrEraString, promptGenData);
  } else {
    const year = parseInt(String(periodOrEraString).substring(0, 4));
    if (!isNaN(year)) {
      if (year >= 2030) era = "future";
      else if (year >= 2000) era = "contemporary";
      else if (year >= 1980) era = "late20th";
      else if (year >= 1950) era = "mid20th";
      else if (year >= 1900) era = "early20th";
      else if (year >= 1800) era = "romantic";
      else if (year >= 1700) era = "classical";
      else if (year >= 1600) era = "baroque";
      else era = "contemporary";
    } else {
      era = "contemporary";
    }
  }
  const filtered = promptGenData.instruments.filter((inst) =>
    isInstrumentCompatibleWithPeriod(inst, era, promptGenData)
  );
  if (filtered.length === 0) {
    const genericModern = [
      "Acoustic Guitar",
      "Piano",
      "Bass Guitar",
      "Vocals",
      "Keyboard",
      "String Section",
    ];
    const genericHistorical = [
      "Vocals",
      "Percussion",
      "Flute",
      "String Section",
      "Harp",
      "Lute",
    ];
    if (
      ["contemporary", "late20th", "mid20th", "early20th", "future"].includes(
        era
      )
    ) {
      return genericModern.filter(
        (inst) =>
          promptGenData.instruments.includes(inst) &&
          isInstrumentCompatibleWithPeriod(inst, era, promptGenData)
      );
    } else if (["baroque", "classical", "romantic"].includes(era)) {
      return genericHistorical.filter(
        (inst) =>
          promptGenData.instruments.includes(inst) &&
          isInstrumentCompatibleWithPeriod(inst, era, promptGenData)
      );
    }
    return ["Vocals", "Acoustic Guitar", "Piano"].filter((i) =>
      promptGenData.instruments.includes(i)
    );
  }
  return filtered;
}

export function getInstrumentsForGenre(
  primaryGenre,
  periodCompatibleInstruments,
  effectiveEra,
  promptGenData
) {
  let affinity = promptGenData.genreInstrumentAffinity[primaryGenre];
  if (!affinity) {
    const genreLower = primaryGenre.toLowerCase();
    if (genreLower.includes("hiphop") || genreLower.includes("hip hop"))
      affinity = promptGenData.genreInstrumentAffinity["HipHop"];
    else if (genreLower.includes("metal"))
      affinity = promptGenData.genreInstrumentAffinity["Metal"];
    else if (genreLower.includes("punk"))
      affinity = promptGenData.genreInstrumentAffinity["Punk"];
    else if (
      genreLower.includes("edm") ||
      (genreLower.includes("electronic") && primaryGenre === "EDM")
    )
      affinity = promptGenData.genreInstrumentAffinity["EDM"];
    else if (genreLower.includes("house"))
      affinity = promptGenData.genreInstrumentAffinity["House"];
    else if (genreLower.includes("techno"))
      affinity = promptGenData.genreInstrumentAffinity["Techno"];
    else if (genreLower.includes("rock"))
      affinity = promptGenData.genreInstrumentAffinity["Rock"];
    else if (genreLower.includes("jazz"))
      affinity = promptGenData.genreInstrumentAffinity["Jazz"];
    else if (genreLower.includes("electronic") || genreLower.includes("synth"))
      affinity = promptGenData.genreInstrumentAffinity["Electronic"];
    else if (genreLower.includes("folk"))
      affinity = promptGenData.genreInstrumentAffinity["Folk"];
    else if (genreLower.includes("blues"))
      affinity = promptGenData.genreInstrumentAffinity["Blues"];
    else if (genreLower.includes("country"))
      affinity = promptGenData.genreInstrumentAffinity["Country"];
    else if (genreLower.includes("pop"))
      affinity = promptGenData.genreInstrumentAffinity["Pop"];
    else if (primaryGenre === "Baroque" || effectiveEra === "baroque")
      affinity = promptGenData.genreInstrumentAffinity["Baroque"];
    else if (primaryGenre === "Renaissance" || effectiveEra === "renaissance")
      affinity = promptGenData.genreInstrumentAffinity["Renaissance"];
    else if (primaryGenre === "Medieval" || effectiveEra === "medieval")
      affinity = promptGenData.genreInstrumentAffinity["Medieval"];
    else if (
      genreLower.includes("classical") ||
      ["classical", "romantic"].includes(effectiveEra)
    )
      affinity = promptGenData.genreInstrumentAffinity["ClassicalMusic"];
    else if (genreLower.includes("ambient"))
      affinity = promptGenData.genreInstrumentAffinity["Ambient"];
  }
  let finalInstrumentList = [...periodCompatibleInstruments];
  if (affinity) {
    if (affinity.exclude && affinity.exclude.length > 0) {
      const excludedLower = affinity.exclude.map((ex) => ex.toLowerCase());
      finalInstrumentList = finalInstrumentList.filter((inst) => {
        const instLower = inst.toLowerCase();
        if (
          affinity.core &&
          affinity.core.map((c) => c.toLowerCase()).includes(instLower)
        )
          return true;
        return !excludedLower.some(
          (ex) => instLower.includes(ex) || ex.includes(instLower)
        );
      });
    }
    if (affinity.core && affinity.core.length > 0) {
      const compatibleCore = affinity.core.filter(
        (coreInst) =>
          periodCompatibleInstruments.includes(coreInst) &&
          isInstrumentCompatibleWithPeriod(
            coreInst,
            effectiveEra,
            promptGenData
          )
      );
      if (compatibleCore.length > 0) {
        const nonCoreInList = finalInstrumentList.filter(
          (inst) => !compatibleCore.includes(inst)
        );
        let biasedPool = [];
        for (let i = 0; i < 3; i++) biasedPool.push(...compatibleCore);
        biasedPool.push(
          ...getRandomElement(nonCoreInList, Math.min(nonCoreInList.length, 2))
        );
        if (biasedPool.length > 0) {
          finalInstrumentList = [...new Set(biasedPool)];
        } else {
          finalInstrumentList = compatibleCore;
        }
        if (
          finalInstrumentList.length < 2 &&
          periodCompatibleInstruments.length > finalInstrumentList.length
        ) {
          finalInstrumentList.push(
            ...getRandomElement(
              periodCompatibleInstruments.filter(
                (i) => !finalInstrumentList.includes(i)
              ),
              2 - finalInstrumentList.length
            )
          );
          finalInstrumentList = [...new Set(finalInstrumentList)];
        }
      }
    }
  }
  if (
    finalInstrumentList.length === 0 &&
    periodCompatibleInstruments.length > 0
  ) {
    finalInstrumentList = [...periodCompatibleInstruments];
  }
  if (finalInstrumentList.length === 0) {
    return getCompatibleInstruments(effectiveEra, promptGenData);
  }
  return [...new Set(finalInstrumentList)];
}

export function getCompatibleVocals(periodOrEraString, promptGenData) {
  let era;
  if (promptGenData.allEras.includes(periodOrEraString)) {
    era = periodOrEraString;
  } else if (promptGenData.periodToEraMap[periodOrEraString]) {
    era = getEraForPeriod(periodOrEraString, promptGenData);
  } else {
    const year = parseInt(String(periodOrEraString).substring(0, 4));
    if (!isNaN(year)) {
      if (year >= 2030) era = "future";
      else if (year >= 2000) era = "contemporary";
      else if (year >= 1980) era = "late20th";
      else if (year >= 1950) era = "mid20th";
      else if (year >= 1900) era = "early20th";
      else era = "contemporary";
    } else {
      era = "contemporary";
    }
  }
  let baseVocals = [...promptGenData.vocals];
  const historicalEras = [
    "ancient",
    "medieval",
    "renaissance",
    "baroque",
    "classical",
    "romantic",
  ];
  if (historicalEras.includes(era)) {
    const allowedHistoricalTokens = [
      "chant",
      "operatic",
      "belting",
      "legato",
      "melismatic",
      "harmonic",
      "choir",
      "folk",
      "story",
      "liturg",
      "clear",
      "pure",
      "resonant",
      "head-voice",
      "falsetto",
      "yodel",
      "keening",
      "plainchant",
      "ballad",
      "madrigal",
      "aria",
      "recitative",
      "lieder",
      "sacred",
      "ethereal",
      "angelic",
      "seraphic",
    ];
    baseVocals = promptGenData.vocals.filter((vocalStyle) => {
      const vocalLower = vocalStyle.toLowerCase();
      if (
        promptGenData.modernVocalStyles.some((modStyle) =>
          vocalLower.includes(modStyle.toLowerCase())
        )
      )
        return false;
      if (
        [
          "rap",
          "electronic",
          "distorted",
          "robotic",
          "glitch",
          "hyperpop",
          "beatbox",
          "industrial",
          "cyber",
          "metal scream",
          "growl",
          "shriek",
          "snarl",
          "autotune",
          "vocal fry",
        ].some((disallowedToken) => vocalLower.includes(disallowedToken))
      )
        return false;
      if (
        allowedHistoricalTokens.some((histToken) =>
          vocalLower.includes(histToken)
        )
      )
        return true;
      const generallySafe =
        !vocalLower.includes("aggressive") &&
        !vocalLower.includes("edgy") &&
        !vocalLower.includes("raw") &&
        !vocalLower.includes("gritty");
      return generallySafe;
    });
    if (baseVocals.length === 0)
      baseVocals = [
        "Melodic",
        "Chanted",
        "Operatic",
        "Clear",
        "Full-bodied",
        "Pure",
        "Angelic",
      ];
  } else if (era === "early20th") {
    baseVocals = promptGenData.vocals.filter((vocalStyle) => {
      const vocalLower = vocalStyle.toLowerCase();
      return ![
        "Autotuned",
        "Hyperpop",
        "Glitch Sounds",
        "Full Growl/Scream (as primary)",
        "Mumbled Rap",
        "Robotic",
        "Heavy Distortion",
      ].some((modStyle) => vocalLower.includes(modStyle.toLowerCase()));
    });
  }
  return baseVocals.length > 0 ? baseVocals : [...promptGenData.vocals];
}

export function generateUdioStructuredPrompt(
  promptGenMode,
  selectedGenreCategoryFromUI,
  promptGenData
) {
  const mode = promptGenMode;
  const isInstrumentalOnly = mode.includes("instrumental");
  const isCoherent = mode.includes("coherent");
  const selectedGenreCategory = selectedGenreCategoryFromUI || "all";
  let promptSegments = [];
  let primaryGenre = null;
  let effectiveEra = "contemporary";
  let finalSelectedPeriodForDisplay = "Contemporary";
  let genrePoolForPrimary = promptGenData.genres;
  let genrePoolForSecondary = promptGenData.genres;
  if (isCoherent) {
    if (
      selectedGenreCategory !== "all" &&
      promptGenData.metaGenreCategories[selectedGenreCategory]
    ) {
      genrePoolForPrimary =
        promptGenData.metaGenreCategories[selectedGenreCategory];
      primaryGenre = getRandomElement(genrePoolForPrimary);
      if (!primaryGenre && promptGenData.genres.length > 0)
        primaryGenre = getRandomElement(promptGenData.genres);
      const typicalErasForPrimary = getTypicalErasForGenre(
        primaryGenre,
        promptGenData
      );
      effectiveEra = selectBestEraFromList(
        typicalErasForPrimary,
        isGenreStrictlyModern(primaryGenre, promptGenData),
        primaryGenre
      );
    } else {
      const tempEraChoices = [
        "contemporary",
        "late20th",
        "mid20th",
        "early20th",
        "romantic",
        "classical",
        "baroque",
        "any_broad",
      ];
      const tempInitialEra = getRandomElement(tempEraChoices);
      genrePoolForPrimary = getGenresForEra(
        tempInitialEra,
        promptGenData,
        "all"
      );
      if (!genrePoolForPrimary || genrePoolForPrimary.length === 0) {
        genrePoolForPrimary = promptGenData.genres;
      }
      primaryGenre = getRandomElement(genrePoolForPrimary);
      if (!primaryGenre && promptGenData.genres.length > 0)
        primaryGenre = getRandomElement(promptGenData.genres);
      const typicalErasForPrimary = getTypicalErasForGenre(
        primaryGenre,
        promptGenData
      );
      effectiveEra = selectBestEraFromList(
        typicalErasForPrimary,
        isGenreStrictlyModern(primaryGenre, promptGenData),
        primaryGenre
      );
    }
    if (!primaryGenre && promptGenData.genres.length > 0)
      primaryGenre = getRandomElement(promptGenData.genres);
    if (!primaryGenre) primaryGenre = "Music";
    finalSelectedPeriodForDisplay = getSensibleDisplayPeriodForEra(
      effectiveEra,
      promptGenData,
      primaryGenre
    );
    genrePoolForSecondary = getGenresForEra(
      effectiveEra,
      promptGenData,
      selectedGenreCategory,
      true
    );
    if (!genrePoolForSecondary || genrePoolForSecondary.length === 0) {
      genrePoolForSecondary = getGenresForEra(
        effectiveEra,
        promptGenData,
        selectedGenreCategory,
        false
      );
      if (!genrePoolForSecondary || genrePoolForSecondary.length === 0) {
        genrePoolForSecondary = getGenresForEra(
          effectiveEra,
          promptGenData,
          "all"
        );
        if (!genrePoolForSecondary || genrePoolForSecondary.length === 0)
          genrePoolForSecondary = [primaryGenre];
      }
    }
  } else {
    finalSelectedPeriodForDisplay = getRandomElement(promptGenData.periods);
    effectiveEra = getEraForPeriod(
      finalSelectedPeriodForDisplay,
      promptGenData
    );
    genrePoolForPrimary =
      selectedGenreCategory !== "all" &&
      promptGenData.metaGenreCategories[selectedGenreCategory]
        ? promptGenData.metaGenreCategories[selectedGenreCategory]
        : promptGenData.genres;
    if (!genrePoolForPrimary || genrePoolForPrimary.length === 0)
      genrePoolForPrimary = promptGenData.genres;
    primaryGenre = getRandomElement(genrePoolForPrimary);
    if (!primaryGenre && promptGenData.genres.length > 0)
      primaryGenre = getRandomElement(promptGenData.genres);
    if (!primaryGenre) primaryGenre = "Music";
    genrePoolForSecondary = genrePoolForPrimary;
  }
  let genreTermsForPrompt = [primaryGenre];
  let numGenres = 1;
  if (Math.random() < 0.4 && genrePoolForSecondary.length > 1) {
    let genre2 = "";
    if (isCoherent && promptGenData.genreToSubgenresMap[primaryGenre]) {
      const potentialSubgenres = promptGenData.genreToSubgenresMap[
        primaryGenre
      ].filter(
        (sg) =>
          genrePoolForSecondary.includes(sg) &&
          sg !== primaryGenre &&
          isGenreCompatibleWithEra(sg, effectiveEra, promptGenData)
      );
      if (potentialSubgenres.length > 0)
        genre2 = getRandomElement(potentialSubgenres);
    }
    if (!genre2) {
      const filteredSecondaryPool = genrePoolForSecondary.filter(
        (sg) =>
          sg !== primaryGenre &&
          (isCoherent
            ? isGenreCompatibleWithEra(sg, effectiveEra, promptGenData)
            : true)
      );
      if (filteredSecondaryPool.length > 0)
        genre2 = getRandomElement(filteredSecondaryPool);
    }
    if (genre2 && genre2 !== primaryGenre) {
      genreTermsForPrompt.push(genre2);
      numGenres = 2;
    }
  }
  let productionAndGenreSegment = "";
  const prod1 = getRandomElement(promptGenData.productions);
  if (numGenres === 1) {
    productionAndGenreSegment = `${prod1} ${genreTermsForPrompt[0]}`;
    if (Math.random() < 0.3 && promptGenData.productions.length > 1) {
      const prod2Single = getRandomElementExcluding(
        promptGenData.productions,
        prod1
      );
      productionAndGenreSegment = `${prod1}, ${prod2Single} ${genreTermsForPrompt[0]}`;
    }
  } else {
    const prod2 = getRandomElementExcluding(promptGenData.productions, prod1);
    productionAndGenreSegment = `${prod1} ${genreTermsForPrompt[0]}, ${prod2} ${genreTermsForPrompt[1]}`;
  }
  promptSegments.push(productionAndGenreSegment.trim());
  const periodCompatibleInstruments = getCompatibleInstruments(
    effectiveEra,
    promptGenData
  );
  let instrumentPool = getInstrumentsForGenre(
    primaryGenre,
    periodCompatibleInstruments,
    effectiveEra,
    promptGenData
  );
  if (!instrumentPool || instrumentPool.length === 0)
    instrumentPool =
      periodCompatibleInstruments.length > 0
        ? periodCompatibleInstruments
        : getCompatibleInstruments("contemporary", promptGenData);
  if (!instrumentPool || instrumentPool.length === 0)
    instrumentPool = [...promptGenData.instruments];
  const emotion1 = getRandomElement(promptGenData.emotions);
  let instrument1 = getRandomElement(instrumentPool);
  if (instrument1) promptSegments.push(`${emotion1} ${instrument1}`.trim());
  if (
    Math.random() < 0.6 &&
    instrumentPool.length > (instrumentPool.includes(instrument1) ? 1 : 0) &&
    instrument1
  ) {
    const emotion2 = getRandomElement(promptGenData.emotions);
    let instrument2 = getRandomElementExcluding(instrumentPool, instrument1);
    if (instrument2 && instrument2 !== instrument1) {
      promptSegments.push(`${emotion2} ${instrument2}`.trim());
    }
  }
  if (!isInstrumentalOnly) {
    let vocalStylePool = getCompatibleVocals(effectiveEra, promptGenData);
    if (vocalStylePool.length === 0) vocalStylePool = promptGenData.vocals;
    const vocalStyle = getRandomElement(vocalStylePool);
    let vocalCategoryDescription = "";
    const baseTypeChance = Math.random();
    let gender = "";
    if (
      primaryGenre &&
      (primaryGenre.toLowerCase().includes("metal") ||
        primaryGenre.toLowerCase().includes("hardcore") ||
        primaryGenre.toLowerCase().includes("hip hop") ||
        primaryGenre.toLowerCase().includes("rap"))
    ) {
      if (Math.random() < 0.75) gender = "Male";
      else gender = "Female";
    } else if (
      primaryGenre &&
      (primaryGenre.toLowerCase().includes("pop") ||
        primaryGenre.toLowerCase().includes("soul") ||
        primaryGenre.toLowerCase().includes("r&b") ||
        primaryGenre.toLowerCase().includes("diva") ||
        primaryGenre.toLowerCase().includes("singer-songwriter"))
    ) {
      if (Math.random() < 0.55) gender = "Female";
      else gender = "Male";
    } else {
      if (Math.random() < 0.5) gender = getRandomElement(["Male", "Female"]);
    }
    if (baseTypeChance < 0.65) {
      vocalCategoryDescription = gender
        ? `${gender} Vocalist`
        : "Solo Vocalist";
    } else if (baseTypeChance < 0.9) {
      vocalCategoryDescription = `${
        gender || getRandomElement(["Male", "Female", "Mixed"])
      } Group Vocals`;
    } else {
      vocalCategoryDescription = `${
        gender || getRandomElement(["Male", "Female", "Mixed"])
      } Choir`;
    }
    if (
      !vocalCategoryDescription.toLowerCase().includes("choir") &&
      Math.random() < 0.33
    ) {
      const role = getRandomElement(["Lead", "Backing"]);
      vocalCategoryDescription = vocalCategoryDescription.replace(
        /(Vocalist|Group Vocals)/i,
        `${role} $1`
      );
    }
    if (vocalStyle && vocalCategoryDescription)
      promptSegments.push(`${vocalStyle} ${vocalCategoryDescription}`.trim());
  }
  let selectedNation = getAffinityNationsForPromptGen(
    primaryGenre,
    effectiveEra,
    promptGenData
  );
  if (selectedNation) promptSegments.push(selectedNation);
  if (finalSelectedPeriodForDisplay)
    promptSegments.push(finalSelectedPeriodForDisplay);
  return promptSegments.filter((s) => s && String(s).trim() !== "").join(", ");
}
