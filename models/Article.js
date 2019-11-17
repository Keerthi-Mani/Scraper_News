// Require mongoose
var mongoose = require("mongoose");
// Create Schema class
var Schema = mongoose.Schema;

// Create article schema
var ArticleSchema = new Schema({
    title: {
        type: String,
    },
    summary: {
        type: String
    },
    link: {
        type: String,
    },
    saved: {
        type: Boolean,
        default: false
    },
    notes: [{
        type: Schema.Types.ObjectId,
        ref: "Note"
    }]
});

// Create the Article model with the ArticleSchema
var Article = mongoose.model("Article", ArticleSchema);

// Export the model
module.exports = Article;