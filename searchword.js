function searchWord(serie) {
    const input = document.getElementById("trefwoord-input").value.trim();
    if (!input) {
        console.warn("⚠️ Geen zoekwoord ingevoerd.");
        return;
    }
    
    const jsonFilePath = `data_${serie}.json`; // Bijvoorbeeld: 'data_fcdk.json' of 'data_theoffice.json'
    
    fetch(jsonFilePath)
        .then(response => response.json())
        .then(data => {
            const stopwords = [
                "is", "am", "the", "it", "a", "and", "of", "on", "in", "at", "there", "to", "for", "with", "without", "as", "to", "by", "to", "out", "his", "I", "you", "he", "she", "we", "they", "my", "your", "his", "her", "our", "your (formal)", "this", "that", "those", "all", "everything", "each", "everyone", "me", "me", "you", "your", "how", "where", "what", "who", "which", "why", "so that", "then", "but", "still", "just", "yet", "self", "between", "about", "under", "above", "to", "out", "as", "when", "now", "later", "here", "there", "somewhere", "also", "to", "just", "alone", "usually", "other", "me", "you", "she", "has", "have", "become", "can", "would", "must", "want", "all", "each", "on it", "to it", "while", "upon", "from which", "from whom", "as long as", "so that", "even", "indeed", "besides", "of course", "under", "during", "because of", "therefore", "then", "so", "still", "today", "so much", "more", "everything", "each", "the one", "without", "many", "this", "that", "except", "what", "without", "unless", "by", "at", "according to", "next to", "since", "now", "later", "long", "fast", "big", "small", "beautiful", "good", "better", "bad", "thick", "thin", "much", "few", "high", "low", "weak", "sometimes", "always", "never", "often", "during", "day", "month", "year", "another", "same", "so much", "yourself", "self", "less", "also", "other", "for example", "almost", "only", "one", "the one", "that thing", "so-called", "exactly", "just", "around", "unless", "in the meantime", "once", "jointly", "something", "someone", "each", "because of", "very", "heavy", "light", "actually", "only", "when", "while", "since then", "for some time"
            ];
            
            function cleanQuery(query) {
                return query
                    .toLowerCase()
                    .split(/\s+/) // Splitsen op spaties
                    .map(word => word.replace(/[^\w\s]/g, "")) // Verwijder leestekens
                    .filter(word => word.length > 0 && !stopwords.includes(word)); // Stopwoorden verwijderen
            }

            // Extract only nouns (zelfstandige naamwoorden) from the input
            const nlp = window.nlp || compromise;
            const nouns = nlp(cleanQuery(input)).nouns().out('array'); // Correcte functie
            const searchWords = nouns.length > 0 ? nouns : input.toLowerCase().split(" "); // Als er zelfstandige naamwoorden zijn, gebruik deze anders de volledige tekst

            console.log(`Onderzochte zelfstandige naamwoorden: ${searchWords.join(", ")}`); // Log de zelfstandige naamwoorden die worden onderzocht

            let expandedSearchWords = [...searchWords]; // Voeg de zoekwoorden toe aan expandedSearchWords

            const options = {
                includeScore: true,
                keys: ["ondertiteling.text"],
                // keys: ["audiotranscriptie.text"],
                threshold: 0.2,
                findAllMatches: true,
                useExtendedSearch: true
            };

            const fuse = new Fuse(data.afleveringen, options);

            // 🔹 Zoek fuzzy matches voor ALLE zoekwoorden
            console.log("Zoeken naar fuzzy matches..."); // Log voor fuzzy search
            const results = expandedSearchWords.flatMap(word => fuse.search(word));
            console.log("Fuzzy zoekresultaten:", results);

            // 🔹 Episodes groeperen en waarschijnlijkheid berekenen
            const episodeScores = {};
            results.forEach(result => {
                const episode = result.item;
                const subtitleText = episode.ondertiteling.map(sub => sub.text.toLowerCase()).join(" ");

                let score = result.score; // Basis fuzzy search score
                let matchType = "fuzzy";

                if (!episodeScores[episode.id]) {
                    episodeScores[episode.id] = { episode, scores: [], matchTypes: [], matchSentences: new Set() };
                }

                // Voeg het aantal keer dat de zoekterm exact voorkomt toe aan de score
                searchWords.forEach(word => {
                    let wordCount = (subtitleText.match(new RegExp("\\b" + word + "\\b", "g")) || []).length;
                    if (wordCount > 0) {
                        score -= 0.5 * wordCount; // Verhoog score als een woord vaker voorkomt
                        matchType = "exact";
                    } else {
                        score -= 0.1; // Ander woord match = low score
                        matchType = "ander woord";
                    }
                });

                episode.ondertiteling.forEach(sub => {
                    let modifiedText = sub.text;
                    let startTime = timeToSeconds(sub.start); // Zet starttijd om naar seconden
                    let endTime = timeToSeconds(sub.end); // Zet eindtijd om naar seconden
                
                    // Voeg zoekwoorden toe aan de tekst en onderlijn deze
                    searchWords.forEach(word => {
                        let regex = new RegExp(`\\b(${word})\\b`, "gi"); // Zoek exact woord (hoofdletterongevoelig)
                        modifiedText = modifiedText.replace(regex, "<u>$1</u>"); // ✅ Onderlijn exacte match
                    });
                
                    if (modifiedText !== sub.text) {
                        episodeScores[episode.id].matchSentences.add({
                            text: modifiedText,
                            startTime: startTime,
                            endTime: endTime 
                        });
                    }
                });
                

                episodeScores[episode.id].scores.push(score);
                episodeScores[episode.id].matchTypes.push(matchType);
            });

            // 🔹 Bereken de gemiddelde score per aflevering en filter lage scores
            const sortedEpisodes = Object.values(episodeScores)
                .map(ep => ({
                    episode: ep.episode,
                    // score: ep.scores.reduce((sum, s) => sum + s, 0),
                    score: ep.scores.reduce((sum, s) => sum + s, 0) / ep.scores.length,
                    matchSentences: Array.from(ep.matchSentences) // ✅ Converteer Set naar Array
                }))
                .map(ep => ({
                    ...ep,
                    score: Math.min(100, (0 - (ep.score * 20))) // Zorg ervoor dat de score nooit boven 100% komt
                }))
                .filter(ep => (0 - (ep.score * 20)) < 0)
                .sort((a, b) => b.score - a.score); // Sorteer van hoog naar laag


            // 🔹 Resultaten tonen
            const topResult = document.getElementById("top-result");
            topResult.innerHTML = "";
            const resultsList = document.getElementById("results-list");
            resultsList.innerHTML = "";

            if (sortedEpisodes.length === 0) {
                topResult.innerHTML = "<li>❌ Geen resultaten gevonden.</li>";
                return;
            }

            function timeToSeconds(timeStr) {
                const [hour, minute, second] = timeStr.split(':');
                const [sec, milli] = second.split(',');
            
                return (parseInt(hour) * 3600) + (parseInt(minute) * 60) + parseInt(sec) + parseInt(milli) / 1000;
            }

            function formatMinute(seconds) {
                if (isNaN(seconds)) {
                    console.warn("Ongeldige starttijd:", seconds);
                    return "";
                }
            
                const minutes = Math.floor(seconds / 60);
                return `Vanaf min. ${minutes}:`;
            }
            

            // Zoek de aflevering met de hoogste score
            const highestScoreEpisode = sortedEpisodes[0];

            // Toon altijd de aflevering met de hoogste score
            const resultItemHighest = document.createElement("li");
            resultItemHighest.classList.add("result-item");
            let confidence = highestScoreEpisode.score.toFixed(1); // Correcte waarschijnlijkheid
            if (confidence > 100) {
                confidence = 100;
            }
            resultItemHighest.innerHTML = 
                `<div class="highest-container">
                    <span class="toggle-text" style="cursor: pointer; font-weight: bold; padding: 5px;">▼</span>
                        <a href="${highestScoreEpisode.episode.url}" target="_blank" class="play-button">
                            <span class="icon">📺 </span> &nbsp; &nbsp; 
                            <strong>${highestScoreEpisode.episode.titel}</strong>
                            <span> Seizoen ${highestScoreEpisode.episode.seizoen}</span> &nbsp; 
                            <span> Aflevering ${highestScoreEpisode.episode.aflevering}</span> &nbsp; 
                            ✔️ ${confidence}%</span>
                        </a>
                    </div>
                    <ul class="match-sentences">
                        ${highestScoreEpisode.matchSentences.map(sentence => 
                                `<li>
                                    <span class="timestamp">${formatMinute(sentence.startTime)}</span> 
                                    ${sentence.text}
                                </li>`).join('')}
                        </ul>
                `;

                // Voeg klikfunctie toe om uit te klappen
                const toggleButton = resultItemHighest.querySelector(".toggle-text");
                const matchSentencesList = resultItemHighest.querySelector(".match-sentences");
                matchSentencesList.style.display = "none";
                toggleButton.addEventListener("click", () => {
                    const isVisible = matchSentencesList.style.display === "block";
                    matchSentencesList.style.display = isVisible ? "none" : "block";
                    toggleButton.textContent = isVisible ? "▼" : "▲";
                });
            topResult.appendChild(resultItemHighest);

            sortedEpisodes.forEach(({ episode, score, matchSentences }) => {
                let confidence = score.toFixed(1); // Correcte waarschijnlijkheid
                if (confidence > 100) {
                    confidence = 100;
                }
                if (episode !== highestScoreEpisode.episode) {
                    const resultItem = document.createElement("li");
                    resultItem.innerHTML = `
                        <div class="result-container">
                            <span class="toggle-text" style="cursor: pointer; font-weight: bold; padding: 5px;">▼</span>
                            <a href="${episode.url}" target="_blank" class="play-button-overige">
                                <span class="icon">📺 </span> &nbsp; &nbsp; 
                                <strong>${episode.titel}</strong>
                                <span>(Seizoen ${episode.seizoen},  
                                Aflevering ${episode.aflevering}) &nbsp; 
                                ✔️ ${confidence}%</span>
                            </a>
                        </div>
                        <ul class="match-sentences">
                            ${matchSentences.map(sentence => 
                                `<li>
                                    <span class="timestamp">${formatMinute(sentence.startTime)}</span> 
                                    ${sentence.text}
                                </li>`).join('')}
                        </ul>
                    `;
            
                    // Voeg klikfunctie toe om uit te klappen
                    const toggleButton = resultItem.querySelector(".toggle-text");
                    const matchSentencesList = resultItem.querySelector(".match-sentences");
                    matchSentencesList.style.display = "none";
                    toggleButton.addEventListener("click", () => {
                        const isVisible = matchSentencesList.style.display === "block";
                        matchSentencesList.style.display = isVisible ? "none" : "block";
                        toggleButton.textContent = isVisible ? "▼" : "▲";
                    });
            
                    resultsList.appendChild(resultItem);
                }       
                console.log(`📺 ${episode.titel} (Seizoen ${episode.seizoen}, Aflevering ${episode.aflevering}) - ✔️ ${confidence}%} 📝 Match: ${matchSentences.join(' | ')}`);
            });
        })
        .catch(error => console.error("❌ Fout bij laden van gegevens:", error));   
}