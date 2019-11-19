//Dependencies
var express = require("express");
var exphbs = require("express-handlebars");
var logger = require("morgan");
var mongoose = require("mongoose");
var bodyParser = require("body-parser");
var path = require("path");
// Our scraping tools
// Axios is a promised-based http library, similar to jQuery's Ajax method
// It works on the client and on the server
var axios = require("axios");
var cheerio = require("cheerio");

// Requiring Note and Article models
var Note = require("./models/Note.js");
var Article = require("./models/Article.js");

// Set mongoose to leverage built in JavaScript ES6 Promises
mongoose.Promise = Promise;

//Define port
var PORT = process.env.PORT || 3000

// Initialize Express
var app = express();

// Configure middleware
// Use morgan logger for logging requests
app.use(logger("dev"));
// Parse request body as JSON
app.use(bodyParser.urlencoded({
    extended: false
}));
app.use(express.json());
// Make public a static folder
app.use(express.static("public"));

//Handlebars
app.engine("handlebars", exphbs({
    defaultLayout: "main",
    partialsDir: path.join(__dirname, "/views/layouts/partials")
}));
app.set("view engine", "handlebars");

// Connect to the Mongo DB
var MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost/scraper_news";
mongoose.connect(MONGODB_URI, {
    useNewUrlParser: true
});
// mongoose.connect("mongodb://user:password1@ds061631.mlab.com:61631/heroku_cxjr7cw4", {
//     useNewUrlParser: true
// });

// Routes
//=========
//GET request for all article to render Handlebars pages
app.get("/", function (req, res) {
    Article.find({
        "saved": false
    }).then(function (dbArticle) {
        res.render("home", {
            article: dbArticle
        })
    }).catch(function (err) {
        // If an error occurred, log it
        console.log(err);
    });
});
//GET request for saved article to render Handlebars pages
app.get("/saved", function (req, res) {
    Article.find({
        saved: true
    }).populate("notes").then(function (dbArticle) {
        res.render("saved", {
            article: dbArticle
        })
    }).catch(function (err) {
        // If an error occurred, log it
        console.log(err);
    });
});

// A GET route for scraping the echoJS website
app.get("/scrape", function (req, res) {
    // First, we grab the body of the html with axios
    axios.get("https://www.nytimes.com/").then(function (response) {
        console.log(response.data);
        // Then, we load that into cheerio and save it to $ for a shorthand selector
        var $ = cheerio.load(response.data);

        // Now, we grab every h2 within an article tag, and do the following:
        $("article").each(function (i, element) {
            // Save an empty result object
            var result = {};

            // Add the title and summary of every link, and save them as properties of the result object
            summary = ""
            if ($(this).find("ul").length) {
                summary = $(this).find("li").first().text();
            } else {
                summary = $(this).find("p").text();
            };
            // Add the text and href of every link, and save them as properties of the result object
            result.title = $(this).find("h2").text().trim();
            result.summary = summary;
            result.link = "https://nytimes.com" + $(this).find("a").attr("href");

            //result.link = $(this).children("a").attr("href");

            // Create a new Article using the `result` object built from scraping
            Article.insertMany(result).then(function (dbArticle) {
                //Article.create(result).then(function (dbArticle) {
                // View the added result in the console
                console.log(dbArticle);
            }).catch(function (err) {
                // If an error occurred, log it
                console.log(err);
            });
        });

        // Send a message to the client
        res.send("Scrape Complete");
    });
});

// Route for getting all Articles from the db
app.get("/articles", function (req, res) {
    // Grab every document in the Articles collection
    Article.find({}).then(function (dbArticle) {
        // If we were able to successfully find Articles, send them back to the client
        //res.json(dbArticle);
        res.render("home", {
            article: dbArticle
        }).catch(function (err) {
            // If an error occurred, send it to the client
            res.json(err);
        });
    });
});

// Route for grabbing a specific Article by id, 
app.get("/articles/:id", function (req, res) {
    // Using the id passed in the id parameter, prepare a query that finds the matching one in our db...
    Article.findOne({
        _id: req.params.id
    }).populate("note").then(function (dbArticle) {
        // If we were able to successfully find an Article with the given id, send it back to the client
        //res.json(dbArticle);
        res.render("home", {
            article: dbArticle
        }).catch(function (err) {
            // If an error occurred, send it to the client
            res.json(err);
        });
    });
});

// Route for saving/updating an Article's associated Note
app.post("/saveArticles/:id", function (req, res) {

    // Since our mongoose query returns a promise, we can chain another `.then` which receives the result of the query
    Article.updateOne({
        _id: req.params.id
    }, {
        saved: true
    }).then(function (dbArticle) {
        // If we were able to successfully update an Article, send it back to the client
        res.redirect("/");
    }).catch(function (err) {
        // If an error occurred, send it to the client
        res.json(err);
    });
});

// Route for saving/deleting an Article's associated Note
app.post("/deleteArticles/:id", function (req, res) {

    // Since our mongoose query returns a promise, we can chain another `.then` which receives the result of the query
    Article.deleteOne({
        _id: req.params.id
    }, {
        saved: false,
        notes: []
    }).then(function (dbArticle) {
        // If we were able to successfully update an Article, send it back to the client
        res.json(dbArticle);
    }).catch(function (err) {
        // If an error occurred, send it to the client
        res.json(err);
    });
});

// Create a new note
app.post("/createNote/:id", function (req, res) {
    var newNote = new Note({
        body: req.body.text,
        article: req.params.id
    });
    newNote.save(function (err, dbNote) {
        if (err) {
            console.log(err);
        } else
            Article.updateOne({
                _id: req.params.id
            }, {
                $push: {
                    notes: dbNote
                }
            }).then(function (err) {
                if (err) {
                    console.log(err);
                } else {
                    res.send(note);
                }
                // //res.json(dbArticle);
                // res.render("saved", {
                //     article: dbArticle
                // }).catch(function (err) {
                //     res.json(err);
                //});
            });
    });
});
// Delete a note
app.delete("/deleteNote/:note_id/:article_id", function (req, res) {
    // Use the note id to find and delete it
    Note.remove({
        _id: req.params.note_id
    }).then(function (err) {
        if (err) {
            console.log(err);
        } else {
            res.send(note);
        }
        // Article.deleteOne({
        //     _id: req.params.article_id
        // }, {
        //     $pull: [{
        //         notes: req.params.note_id
        //     }]
        //     // Execute the above query
        // }).then(function (err) {
        //     if (err) {
        //         console.log(err);
        //     } else {
        //         res.send(note);
        //     }
        //     res.render("saved", {
        //         article: dbArticle
        //     }).catch(function (err) {
        //         res.json(err);
        //     });

        // });
    });

});

// Start the server
app.listen(PORT, function () {
    console.log("App running on port " + PORT + "!");
});