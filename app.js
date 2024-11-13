// Load environment variables from .env file
require("dotenv").config();
const http = require("http");
const fs = require('fs');
const path = require('path');
const formidable = require('formidable');

// Retrieve API keys from environment variables
const OMDB_API_KEY = process.env.OMDB_API_KEY;
const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;

async function getCombinedMovieData(input, res) {
    try {
        let movieData;

        // Check if input is IMDb ID or title
        if (input.startsWith("tt")) {
            // Input is an IMDb ID
            movieData = await fetchJSON(`http://www.omdbapi.com/?apikey=${OMDB_API_KEY}&i=${input}`);
        } else {
            // Input is a title
            movieData = await fetchJSON(`http://www.omdbapi.com/?apikey=${OMDB_API_KEY}&t=${encodeURIComponent(input)}`);
        }

        // Check if movie data was found
        if (!movieData || movieData.Response === "False") {
            res.writeHead(404, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Movie not found" }));
            return;
        }

        // Get streaming availability based on IMDb ID
        const imdbId = movieData.imdbID;
        const url = `https://streaming-availability.p.rapidapi.com/shows/search/filters?imdb_id=${imdbId}&country=us&output_language=en`;
        const options = {
            method: 'GET',
            headers: {
                'x-rapidapi-key': RAPIDAPI_KEY,
                'x-rapidapi-host': 'streaming-availability.p.rapidapi.com'
            }
        };
        const streamingData = await fetchJSON(url, options);

        // Format streaming availability data if available
        const showsArray = streamingData?.shows || [];
        const services = showsArray[0]?.streamingOptions?.us || [];

        // Use the formattedServices mapping here
        const formattedServices = services.map(option => {
            // Try to infer provider from the link
            let provider = "Unknown";
            if (option.link.includes("netflix")) provider = "Netflix";
            else if (option.link.includes("amazon")) provider = "Amazon Prime Video";
            else if (option.link.includes("hulu")) provider = "Hulu";
            else if (option.link.includes("disney")) provider = "Disney+";
            else if (option.link.includes("hbo")) provider = "HBO Max";
            else if (option.link.includes("apple")) provider = "Apple TV+";

            return {
                provider: provider,
                transactionType: option.type || "Unknown",   // e.g., "rent", "buy", "subscription"
                quality: option.quality || 'Not specified',  // e.g., "uhd", "hd"
                price: option.price ? `${option.price.formatted}` : 'N/A',  // Display price if available
                link: option.link
            };
        });

        // Combine the full movie data and formatted streaming availability
        const combinedData = {
            ...movieData, // Include all movie data fields from OMDb
            streamingAvailability: formattedServices
        };

        res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
        res.end(JSON.stringify(combinedData));
    } catch (error) {
        console.error("Error combining movie data:", error.message);
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Error combining movie data" }));
    }
}



// Helper function to fetch JSON data from an API
async function fetchJSON(url, options = {}) {
    try {
        // Fetch data from the provided URL with specified options
        const response = await fetch(url, options);
        if (!response.ok) {
            // Throw error if response status is not OK
            throw new Error(`Request failed with status ${response.status}`);
        }
        // Return the response in JSON format
        return await response.json();
    } catch (error) {
        console.error("Error fetching JSON data:", error.message);
        // Propagate the error to calling function
        throw new Error("Error fetching data from external API");
    }
}

// Helper function to check for an uploaded poster
function checkUploadedPoster(imdbId) {
    const filePath = path.join(__dirname, 'posters', `${imdbId}.jpg`);
    return fs.existsSync(filePath) ? `/movies/poster/${imdbId}` : null;
   }
   
   // Modified searchMovieByTitle function
   async function searchMovieByTitle(title, res) {
    try {
        if (!title) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Title parameter is missing" }));
            return;
        }
   
        const omdbResponse = await fetchJSON(`http://www.omdbapi.com/?apikey=${OMDB_API_KEY}&t=${encodeURIComponent(title)}`);
        
        // Check for poster
        if (!omdbResponse.Poster || omdbResponse.Poster === "N/A") {
            const imdbId = omdbResponse.imdbID;
            const uploadedPoster = checkUploadedPoster(imdbId);
            omdbResponse.Poster = uploadedPoster || null;
            omdbResponse.poster_upload_recommended = !uploadedPoster;
        }
   
        res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
        res.end(JSON.stringify(omdbResponse));
    } catch (error) {
        console.error("Error fetching movie data by title:", error.message);
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Error fetching movie data by title" }));
    }
   }
   
   // Modified getMovieDataByImdbId function
   async function getMovieDataByImdbId(imdbId, res) {
    try {
        if (!imdbId) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "IMDb ID parameter is missing" }));
            return;
        }
   
        const omdbResponse = await fetchJSON(`http://www.omdbapi.com/?apikey=${OMDB_API_KEY}&i=${imdbId}`);
        
        // Check for poster
        if (!omdbResponse.Poster || omdbResponse.Poster === "N/A") {
            const uploadedPoster = checkUploadedPoster(imdbId);
            omdbResponse.Poster = uploadedPoster || null;
            omdbResponse.poster_upload_recommended = !uploadedPoster;
        }
   
        res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
        res.end(JSON.stringify(omdbResponse));
    } catch (error) {
        console.error("Error fetching movie data by IMDb ID:", error.message);
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Error fetching movie data by IMDb ID" }));
    }
   }

// Endpoint: Search for movie data by title
async function searchMovieByTitle(title, res) {
    try {
        // Check if title parameter is provided
        if (!title) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Title parameter is missing" }));
            return;
        }

        // Call OMDb API to fetch movie data by title
        const omdbResponse = await fetchJSON(`http://www.omdbapi.com/?apikey=${OMDB_API_KEY}&t=${encodeURIComponent(title)}`);
        res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
        res.end(JSON.stringify(omdbResponse));
    } catch (error) {
        console.error("Error fetching movie data by title:", error.message);
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Error fetching movie data by title" }));
    }
}

// Endpoint: Get streaming availability by IMDb ID
async function getStreamingAvailability(imdbId, res) {
    const url = `https://streaming-availability.p.rapidapi.com/shows/search/filters?imdb_id=${imdbId}&country=us&output_language=en`;
    const options = {
        method: 'GET',
        headers: {
            'x-rapidapi-key': RAPIDAPI_KEY,
            'x-rapidapi-host': 'streaming-availability.p.rapidapi.com'
        }
    };

    try {
        // Check if IMDb ID parameter is provided
        if (!imdbId) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "IMDb ID parameter is missing" }));
            return;
        }

        // Fetch streaming availability data
        const streamingData = await fetchJSON(url, options);
        const showsArray = streamingData?.shows;

        // Check if any shows are found in the response
        if (!showsArray || !Array.isArray(showsArray) || showsArray.length === 0) {
            res.writeHead(404, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
            res.end(JSON.stringify({ error: "No streaming availability found" }));
            return;
        }

        // Extract streaming services for US region
        const services = showsArray[0]?.streamingOptions?.us || [];
        if (services.length === 0) {
            res.writeHead(404, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
            res.end(JSON.stringify({ error: "No streaming availability found for the US region" }));
            return;
        }

        // Format the services data to send a cleaner response
        const formattedServices = services.map(option => ({
            type: option.type,
            link: option.link,
            quality: option.quality || 'Not specified'
        }));

        res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
        res.end(JSON.stringify({ services: formattedServices }));
    } catch (error) {
        console.error("Error fetching streaming availability by IMDb ID:", error.message);
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Error fetching streaming availability by IMDb ID" }));
    }
}

// Endpoint: Upload movie poster
function uploadMoviePoster(req, res) {
    const form = new formidable.IncomingForm();
    form.uploadDir = path.join(__dirname, 'posters');
    form.keepExtensions = true;

    form.parse(req, (err, fields, files) => {
        console.log("Fields:", fields);  // Log fields
        console.log("Files:", files);    // Log files

        if (err) {
            console.error("Error parsing the form:", err.message);
            res.writeHead(500, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Error processing the file" }));
            return;
        }

        const imdbId = req.headers['imdb-id'];
        if (!imdbId) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "IMDb ID header is missing" }));
            return;
        }

        if (!files.file || !files.file[0]) { // Check if 'file' is missing
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "File not uploaded correctly or file is missing." }));
            return;
        }

        const oldPath = files.file[0].filepath; // Use the first file in the array
        const newFilePath = path.join(form.uploadDir, `${imdbId}.jpg`);

        fs.rename(oldPath, newFilePath, (err) => {
            if (err) {
                console.error("Error saving the poster:", err.message);
                res.writeHead(500, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ error: "Error saving the poster" }));
                return;
            }

            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ message: "Poster uploaded successfully" }));
        });
    });
}


// Endpoint: Retrieve movie poster by IMDb ID
async function getMoviePoster(imdbId, res) {
    try {
        // Step 1: Attempt to fetch the poster from the OMDb API
        const omdbUrl = `http://www.omdbapi.com/?apikey=${process.env.OMDB_API_KEY}&i=${imdbId}`;
        const omdbResponse = await fetch(omdbUrl);
        const omdbData = await omdbResponse.json();

        if (omdbData.Poster && omdbData.Poster !== "N/A") {
            // If the poster exists on OMDb, redirect to this URL
            res.writeHead(302, { Location: omdbData.Poster });
            return res.end();
        }

        // Step 2: Check for a locally stored poster if OMDb did not have one
        const filePath = path.join(__dirname, 'posters', `${imdbId}.jpg`);
        if (fs.existsSync(filePath)) {
            // If local poster exists, read and send the image file
            const img = fs.readFileSync(filePath);
            res.writeHead(200, { "Content-Type": "image/jpeg" });
            return res.end(img);
        }

        // Step 3: If neither OMDb nor the local folder has the poster, prompt for upload
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ message: "Poster not found. Please upload a poster for this movie." }));

    } catch (error) {
        console.error("Error retrieving poster:", error);
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ message: "An error occurred while retrieving the poster or the IMDB ID is invalid." }));
    }
}

// Main routing function to handle different endpoints
function routing(req, res) {
    const url = req.url;
    const method = req.method;

    // Route requests based on URL and method
    if (url.startsWith("/movies/combined/") && method === "GET") {
        const input = url.split("/movies/combined/")[1];
        getCombinedMovieData(input, res);

    } else if (url.startsWith("/movies/search/") && method === "GET") {
        const title = url.split("/movies/search/")[1];
        searchMovieByTitle(title, res);

    } else if (url.startsWith("/movies/data/") && method === "GET") {
        const imdbId = url.split("/movies/data/")[1];
        getMovieDataByImdbId(imdbId, res);

    } else if (url.startsWith("/movies/availability/") && method === "GET") {
        const imdbId = url.split("/movies/availability/")[1];
        getStreamingAvailability(imdbId, res);

    } else if (url === "/movies/poster/upload" && method === "POST") {
        uploadMoviePoster(req, res);

    } else if (url.startsWith("/movies/poster/") && method === "GET") {
        const imdbId = url.split("/movies/poster/")[1];
        getMoviePoster(imdbId, res);

    } else {
        // Default response for undefined routes
        res.writeHead(404, { "Content-Type": "text/plain" });
        res.end("No matching page");
    }
}

// Create and start the server
http.createServer(routing).listen(5000, () => {
    console.log("Server started at port 5000");
});

