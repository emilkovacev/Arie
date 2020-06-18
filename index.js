// require the discord.js module
const Discord = require('discord.js');
const Sequelize = require('sequelize');
const superagent = require('superagent');

const sequelize = new Sequelize('database', 'user', 'password', {
	host: 'localhost',
	dialect: 'sqlite',
	logging: false,
	// SQLite only
	storage: 'database.sqlite',
});

const Tags = sequelize.define('tags', {
	name: {
		type: Sequelize.STRING,
		unique: true,
	},
	description: Sequelize.TEXT,
	username: Sequelize.STRING,
	usage_count: {
		type: Sequelize.INTEGER,
		defaultValue: 0,
		allowNull: false,
	},
});

const { prefix, token } = require('./config.json');
// create a new Discord client
const client = new Discord.Client();

// when the client is ready, run this code
// this event will only trigger one time after logging in
client.once('ready', () => {
    Tags.sync();
	console.log('synced');
});

client.on('message', async message => {
	if (message.content.startsWith(prefix)) {
		const input = message.content.slice(prefix.length).split(' ');
		const command = input.shift();
        const commandArgs = input.join(' ');
        
		if (command === 'add') {
            const movieTitle = commandArgs
            const allMovies = movieTitle.split(",")

            try {
                for (movie of allMovies) {
                    console.log(movie.trim())
                    // equivalent to: INSERT INTO tags (name, description, username) values (?, ?, ?);
                    const tag = await Tags.create({
                        name: movie.trim(),
                        description: "IMdB description will be taken from API later",
                        username: message.author.username,
                    });
                    message.channel.send(`${movie.trim()} added`);
                }
            }
            catch (e) {
                if (e.name === 'SequelizeUniqueConstraintError') {
                    return message.channel.send('That movie is already on the list');
                }
                return message.channel.send('Something went wrong with adding a tag');
            }
        } else if (command === 'edit_movie' || command === 'e') {
            const splitArgs = commandArgs.split(' ');
            const tagName = splitArgs.shift();
            const tagDescription = splitArgs.join(' ');
            
            // equivalent to: UPDATE tags (descrption) values (?) WHERE name='?';
            const affectedRows = await Tags.update({ description: tagDescription }, { where: { name: tagName } });
            if (affectedRows > 0) {
                return message.channel.send(`Tag ${tagName} was edited.`);
            }
            return message.channel.send(`Could not find a tag with name ${tagName}.`);
		} else if (command === 'info' || command == 'i') {
            
            const tagName = commandArgs;

            // equivalent to: SELECT * FROM tags WHERE name = 'tagName' LIMIT 1;
            const tag = await Tags.findOne({ where: { name: tagName } });

            if (tag) {
                console.log(tagName)
                let movie_title = tagName.trim().replace(/ /g, "+");
                let {body} = await superagent
                .get(`http://www.omdbapi.com/?apikey=81effb01&t=` + movie_title.toLowerCase())
                
                let movieEmbed = new Discord.RichEmbed()
                .setColor("#ff9900")
                .setTitle(body.Title)
                .setImage(body.Poster)
                // .setDescription()
                .addField('Year', body.Year, false)
                .addField('Director', body.Director, true)
                .addField('Genre', body.Genre, true)
                .addField('Runtime', body.Runtime, true)
                .addField('Plot', body.Plot, false)
                .addField('Awards', body.Awards, false)
                .setFooter(`${tagName} was added by ${tag.username} on ${tag.createdAt}`)

                return message.channel.send(movieEmbed)
            } else {
                return message.channel.send(`Could not find ${tagName}`);
            }
            
		} else if (command === 'show' || command === 's') {
            // equivalent to: SELECT name FROM tags;
            const tagList = await Tags.findAll({ attributes: ['name'] });
            const tagString = tagList.map(t => t.name).join(', ') || 'No movies set.';
            return message.channel.send(`${tagString}`);
        } else if (command === 'find_info' || command == 'f') {
            
            const tagName = commandArgs;

            console.log(tagName)
            let movie_title = tagName.trim().replace(/ /g, "+");
            let {body} = await superagent
            .get(`http://www.omdbapi.com/?apikey=81effb01&t=` + movie_title.toLowerCase())
            
            let movieEmbed = new Discord.RichEmbed()
            .setColor("#ff9900")
            .setTitle(body.Title)
            .setImage(body.Poster)
            // .setDescription()
            .addField('Year', body.Year, false)
            .addField('Director', body.Director, true)
            .addField('Genre', body.Genre, true)
            .addField('Runtime', body.Runtime, true)
            .addField('Plot', body.Plot, false)
            .addField('Awards', body.Awards, false)

            return message.channel.send(movieEmbed)
            
		} else if (command === 'remove_movie' || command === 'r') {
            const tagName = commandArgs;
            // equivalent to: DELETE from tags WHERE name = ?;
            const rowCount = await Tags.destroy({ where: { name: tagName } });
            if (!rowCount) return message.channel.send('That movie was not in the list.');
            
            return message.channel.send('Movie removed.');
        } else if (command == 'clear_list' || command === 'c') {

            if (message.member.hasPermission("ADMINISTRATOR")) {
                const tagList = await Tags.findAll({ attributes: ['name'] });
                const tagName = commandArgs;
                // equivalent to: DELETE from tags WHERE name = ?;
                const rowCount = await Tags.destroy({
                    where: {},
                    truncate: true
                })
                if (!rowCount) return message.channel.send('List is empty');
                
                return message.channel.send('List cleared');
            } else {
                return message.channel.send('Your lack of permissions is disturbing...');
            }
        } else if (command == 'help' || command === 'h'){
            
            message.channel.send({embed: {
                color: 10197915,
                title: "Commands",
                fields: [
                    { name: '!add', value: 'Adds the name of the film following the command\n- Ex: !add Princess Mononoke\n- |!!| use commas to add multiple movies at once!' },
                    { name: '!info / !i', value: 'finds the info of the film, as long as the film is in the list, following the command (In development)\n- Ex: !info Princess Mononoke' },
                    { name: '!find_info / !f', value: 'finds the info of any film, following the command (In development)\n- Ex: !find_info Naruto Shippuden: The Movie' },
                    { name: '!show / !s', value: 'shows the current list of films' },
                    { name: '!clear / !c', value: 'clears the current list (only available to Mods)' },
                    { name: '!rng', value: 'picks a random movie to watch, and clears it from the list' },
                ],
                timestamp: new Date(),
                footer: {
                  icon_url: client.user.avatarURL,
                  text: "Thank you for using FilmBot"
                }
              }
            });

        } else if (command == 'choose_movie' || command === 'rng') {

            let user = message.author.username

            console.log(user)

            if (message.member.hasPermission("ADMINISTRATOR")) {
                const movieList = await Tags.findAll({ attributes: ['name'] });
                if (movieList.length > 1) {
                    const randInd = Math.floor(Math.random() * movieList.length)

                    console.log(randInd)

                    const randMov = (movieList[randInd])

                    console.log(movieList.length)
                    console.log("----------")

                    const rowCount = await Tags.destroy({ where: { name: randMov.name } });
                    if (!rowCount) return message.channel.send('A strange error has occurred...');
                
                    return message.channel.send(`${randMov.name}`);
                } else if (movieList.length == 1) {
                    return message.channel.send(`There's only one movie in the list!`);
                } else {
                    return message.channel.send('The list is empty!');
                }

            }
        }
	}
});

client.login(token);