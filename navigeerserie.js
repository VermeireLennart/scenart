window.onload = function() {
    window.selectedSearchType = "";
    // updateBackButtonVisibility(); // Check if a series is selected when the page loads
    // const backButton = document.querySelector('.menu');
    // if (backButton) {
    //     backButton.addEventListener('click', function(event) {
    //         // Remove selected series from localStorage
    //         localStorage.removeItem("selectedSeries");

    //         // Optionally, you could redirect to index.html or perform any other action
    //         window.location.href = "index.html"; // Redirect to home page
    //     });
    // }
};

const seriesData = {
    "fcdk": { title: "FC De Kampioenen", logo: "images/fcdk_logo.png" },
    "theoffice": { title: "The Office", logo: "images/the_office_logo.png" },
    "friends": { title: "Friends", logo: "images/friends_logo.png" },
    "heteiland": { title: "Het Eiland", logo: "images/heteiland_logo.png" },
    "nonkels": { title: "Nonkels", logo: "images/nonkels_logo.png" },
    "w817": { title: "W817", logo: "images/w817_logo.png" }
};

function loadSeries(serie) {
    localStorage.setItem("selectedSeries", serie);
    fetch(`serie.html?serie=${serie}`)  // Laad de generieke seriepagina
        .then(response => response.text())
        .then(html => {
            document.getElementById("start-screen").style.display = "none";  // Verberg startmenu
            let contentDiv = document.getElementById("dynamic-content");
            contentDiv.style.display = "block";
            contentDiv.innerHTML = html;

            // Update de serie-inhoud op basis van de gekozen serie
            updateSerieContent(serie);
            updateBackButtonVisibility(); // Hide or show back button based on selection
        })
        .catch(error => console.error("Fout bij laden van pagina:", error));
}

// Function to update the visibility of the back button
function updateBackButtonVisibility() {
    const backButton = document.querySelector('.menu');
    const selectedSeries = localStorage.getItem("selectedSeries");
    
    if (selectedSeries) {
        backButton.style.display = 'block'; // Show back button if a series is selected
    } else {
        backButton.style.display = 'none'; // Hide back button if no series is selected
    }
}

// Functie om de juiste input (trefwoord of meerdere trefwoorden) weer te geven
function toggleTrefwoordInput(type) {
    window.selectedSearchType = type;

    document.getElementById("trefwoord-div").style.display = "none";
    document.getElementById("meerdere-trefwoorden-div").style.display = "none";
    document.getElementById("beschrijving-div").style.display = "none";

    if (type === "single") {
        document.getElementById("trefwoord-div").style.display = "block";
    } else if (type === "multiple") {
        document.getElementById("meerdere-trefwoorden-div").style.display = "block";
    } else if (type === "description") {
        document.getElementById("beschrijving-div").style.display = "block";
    }
}

// Functie om extra informatie weer te geven (personages, seizoen/aflevering)
function toggleExtraInfo() {
    const extraInfo = document.getElementById("extra-info");
    const arrow = document.getElementById("arrow");

    if (extraInfo.style.display === "none") {
        extraInfo.style.display = "block";
        arrow.textContent = "▲";  // Verander de pijl naar omhoog
    } else {
        extraInfo.style.display = "none";
        arrow.textContent = "▼";  // Verander de pijl naar omlaag
    }
}

function submitSearch() {
    // Verberg de resultaten sectie voordat we beginnen
    document.querySelector('.results').style.display = 'none';

    const selectedSerie = localStorage.getItem("selectedSeries");
    if (!selectedSerie) {
        console.warn("⚠️ Geen serie geselecteerd.");
        return;
    }

    if (window.selectedSearchType === "single") {
        if (typeof searchWord === "function") {
            searchWord(selectedSerie);
        } else {
            console.error("searchWord() is not defined!");
        }
    } else if (window.selectedSearchType === "multiple") {
        if (typeof searchMultipleWords === "function") {
            searchMultipleWords(selectedSerie);
        } else {
            console.error("searchMultipleWords() is not defined!");
        }
    } else if (window.selectedSearchType === "description") {
        alert("Coming soon...");
    } else {
        console.error("No valid search type selected");
    }

    // Nadat de zoekresultaten zijn opgehaald, maak de sectie zichtbaar
    // (voorbeeld: als er zoekresultaten zijn)
    let resultsAvailable = true; // Dit is een voorbeeld; werk met je echte resultaatdata

    if (resultsAvailable) {
        document.querySelector('.results').style.display = 'block';
    }
}

function updateSerieContent(serie) {
    const serieData = seriesData[serie] || { title: "", logo: "images/scnart_logo_wit.png" };
    
    document.getElementById("serie-titel").textContent = serieData.title;
    document.getElementById("serie-logo").src = serieData.logo;
}
