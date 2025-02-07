function searchMultipleWords() {
    const inputElement = document.getElementById("meerdere-trefwoorden-input");
    
    if (!inputElement) {
        console.error("⚠️ Element met id 'meerdere-trefwoorden-input' niet gevonden!");
        return; // Stop de functie om fouten te voorkomen
    }
    const input = inputElement.value ? inputElement.value.trim() : ""; // Voorkomt fouten
    console.log("Ingevoerde waarde:", input);
    
    if (!input) {
        console.warn("⚠️ Geen zoekwoorden ingevoerd.");
        return;
    }

    fetch("data.json")
        .then(response => response.json())
        .then(data => {
            // Stopwoorden om uit te sluiten
            const stopwords = ["is", "de", "het", "een", "en", "van", "op", "in", "bij", "te", "voor", "met", "zonder"];
            
            // Schoonmaakfunctie voor zoekwoorden
            function cleanQuery(query) {
                return query.toLowerCase()
                    .split(/\s+/)
                    .map(word => word.replace(/[^\w\s]/g, ""))  // Verwijder speciale tekens
                    .filter(word => word.length > 0 && !stopwords.includes(word)); // Verwijder stopwoorden
            }

            // Verwerk de zoekwoorden
            const words = cleanQuery(input);
            console.log(`🔍 Geanalyseerde zoekwoorden: ${words.join(", ")}`);

            // Instellen van Fuse.js voor zoekfunctionaliteit
            const fuseOptions = {
                includeScore: true,
                keys: ["ondertiteling.text"],
                threshold: 0.4,
                findAllMatches: true
            };

            const fuse = new Fuse(data.afleveringen, fuseOptions);
            let episodeScores = {};

            // Loop door de zoekwoorden
            words.forEach(word => {
                const results = fuse.search(word);
                
                // Loop door de afleveringen die het zoekwoord bevatten
                results.forEach(result => {
                    const episode = result.item;
                    if (!episodeScores[episode.id]) {
                        episodeScores[episode.id] = {
                            episode,
                            matchedWords: new Set(),
                            matchSentences: [],  // Dit houdt de zinnen bij die het zoekwoord bevatten
                            results: []  // Voeg een results array toe
                        };
                    }

                    // Zoek naar zinnen die het woord bevatten
                    episode.ondertiteling.forEach(sub => {
                        if (sub.text.toLowerCase().includes(word)) {
                            // Sla de zin op als deze het zoekwoord bevat
                            const highlightedSentence = sub.text.replace(new RegExp(`\\b${word}\\b`, 'gi'), "<u>$&</u>");
                            if (!episodeScores[episode.id].matchSentences.includes(highlightedSentence)) {
                                episodeScores[episode.id].matchSentences.push(highlightedSentence);
                            }
                        }
                    });

                    // Voeg het zoekwoord toe aan de set van gematchte woorden voor deze aflevering
                    episodeScores[episode.id].matchedWords.add(word);

                    // Voeg de huidige zoekresultaten toe aan de episode's 'results'
                    episodeScores[episode.id].results.push(result);
                });
            });

            // Functie voor het berekenen van de score
            function calculateScoreForEpisode(episode, words, results) {
                let score = 0;  // Begin met een score van 0
                let matchedWordsCount = 0;
                let matchedWords = new Set();

                // Loop door de zoekwoorden en pas score aan
                words.forEach(word => {
                    const wordCount = (episode.ondertiteling.map(sub => sub.text.toLowerCase()).join(" ").match(new RegExp("\\b" + word + "\\b", "g")) || []).length;

                    if (wordCount > 0) {
                        score += 0.5 * wordCount;  // Verhoog score bij meerdere matches
                        matchedWords.add(word);
                        matchedWordsCount++;
                    } else {
                        score -= 0.2;  // Straf voor niet gevonden zoekwoorden
                    }
                });

                // Normaliseer score naar 100% en zorg voor afronding naar twee decimalen
                // let normalizedScore = Math.min(100, Math.max(0, (score * 10).toFixed(2)));
                let normalizedScore = score*20

                return { normalizedScore, matchedWordsCount, matchedWords };
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

            // Sorteer afleveringen op score en log de resultaten
            const sortedEpisodes = Object.values(episodeScores)
                .map(ep => {
                    const { normalizedScore, matchedWordsCount, matchedWords } = calculateScoreForEpisode(ep.episode, words, ep.results);
                    return {
                        episode: ep.episode,
                        score: normalizedScore,
                        matchedWordsCount: matchedWordsCount,
                        matchedWords: matchedWords,
                        matchSentences: Array.from(ep.matchSentences) // ✅ Converteer Set naar Array
                    };
                })
                .filter(ep => ep.matchedWordsCount > 0)
                .sort((a, b) => b.score - a.score);  // Sorteer van hoog naar laag

            // Resultaten tonen in de UI
            const topResult = document.getElementById("top-result");
            topResult.innerHTML = "";  // Maak de bestaande resultaten leeg
            const resultsList = document.getElementById("results-list");
            resultsList.innerHTML = "";  // Maak de lijst van overige resultaten leeg

            if (sortedEpisodes.length === 0) {
                topResult.innerHTML = "<li>❌ Geen resultaten gevonden.</li>";
                return;
            }

            // Toon altijd de aflevering met de hoogste score bovenaan
            const highestScoreEpisode = sortedEpisodes[0];
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
            topResult.appendChild(resultItemHighest);

            // Log de zinnen voor de aflevering met de hoogste score in de console
            console.log(`📺 ${highestScoreEpisode.episode.titel} (Seizoen ${highestScoreEpisode.episode.seizoen}, Aflevering ${highestScoreEpisode.episode.aflevering})`);
            highestScoreEpisode.matchSentences.forEach(sentence => {
                console.log(`   - Zin: ${sentence}`);
            });

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
