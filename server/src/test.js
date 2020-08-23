const mongoose = require('mongoose');

const connect = () => {
    return mongoose.connect('mongodb://localhost:27017/whatever')
}

const quote = new mongoose.Schema({
    title: String,
    author: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'author'
    }
})

const author = new mongoose.Schema({
    name: String
})

const Quote = mongoose.model('quote', quote)
const Author = mongoose.model('author', author)

connect()
    .then(async connection => {
        const author = await Author.create({name: 'Bill Vining'})
        const author2 = await Author.create({name: 'Bob Vining'})
        const author3 = await Author.create({name: 'James Vining'})
        const author4 = await Author.create({name: 'Smith Smith'})
        const quote = await Quote.create({title: 'Great quote', author: author._id})
    
        const match = await Quote.findById(quote._id)
            .populate('author')
            .exec()
        console.log(match)
    })
    .catch(e => console.error(e))