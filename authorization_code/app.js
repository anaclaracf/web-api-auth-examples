/**
 * This is an example of a basic node.js script that performs
 * the Authorization Code oAuth2 flow to authenticate against
 * the Spotify Accounts.
 *
 * For more information, read
 * https://developer.spotify.com/web-api/authorization-guide/#authorization_code_flow
 */

var express = require('express'); // Express web server framework
var request = require('request'); // "Request" library
var cors = require('cors');
require("dotenv").config();
const aws = require('aws-sdk');
var querystring = require('querystring');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var client_id = "ca202a7d6b6646aa9458a56515b54270"; // Your client id
var client_secret = "86f8504207464693b44033275c2a6ee7"; // Your secret
// let s3 = new aws.S3({
// 	client_id: process.env.client_id,
// 	client_secret: process.env.client_secret
// });

var redirect_uri = 'https://web-api-auth-examples.herokuapp.com/callback';
var access_token;
var refresh_token;
var user_id;

/**
 * Generates a random string containing numbers and letters
 * @param  {number} length The length of the string
 * @return {string} The generated string
 */

var generateRandomString = function(length) {
	var text = '';
	var possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

	for (var i = 0; i < length; i++) {
		text += possible.charAt(Math.floor(Math.random() * possible.length));
	}
	return text;
};

var stateKey = 'spotify_auth_state';
var indexRouter = require('./index');
var app = express();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

app.use(express.static(__dirname + '/public')).use(cors()).use(cookieParser());

app.use('/router', indexRouter).use(cors()).use(cookieParser());

app.get('/login', function(req, res) {
	var state = generateRandomString(16);
	res.cookie(stateKey, state);

	// your application requests authorization
	var scope =
		'user-read-private user-read-email user-library-read user-read-currently-playing user-read-recently-played user-top-read';
	res.redirect(
		'https://accounts.spotify.com/authorize?' +
			querystring.stringify({
				response_type: 'code',
				// client_id: s3.config.client_id,
				client_id: client_id,
				scope: scope,
				redirect_uri: redirect_uri,
				state: state
			})
	);
});

// app.​get​(​'/'​, (​req​, ​res​, ​next​) ​=>​​res​.​status​(​200​).​json​({​message:"API funcionando /o/"​}));

app.get('/', function(req, res) {
	console.log('API funcionando');
});

app.get('/callback', function(req, res) {
	// your application requests refresh and access tokens
	// after checking the state parameter

	var code = req.query.code || null;
	var state = req.query.state || null;
	var storedState = req.cookies ? req.cookies[stateKey] : null;

	if (state === null || state !== storedState) {
		res.redirect(
			'/#' +
				querystring.stringify({
					error: 'state_mismatch'
				})
		);
	} else {
		res.clearCookie(stateKey);
		var authOptions = {
			url: 'https://accounts.spotify.com/api/token',
			form: {
				code: code,
				redirect_uri: redirect_uri,
				grant_type: 'authorization_code'
			},
			headers: {
				Authorization: 'Basic ' + new Buffer(client_id + ':' + client_secret).toString('base64')
			},
			json: true
		};

		request.post(authOptions, function(error, response, body) {
			if (!error && response.statusCode === 200) {
				access_token = body.access_token;
				refresh_token = body.refresh_token;

				var options = {
					url: 'https://api.spotify.com/v1/me',
					headers: { Authorization: 'Bearer ' + access_token },
					json: true
				};
				// use the access token to access the Spotify Web API
				request.get(options, function(error, response, body) {
					console.log(body);
					user_id = body.id;
				});

				// we can also pass the token to the browser to make requests from there
				res.redirect(
					// 'http://localhost:3000/home/#' +
					'https://musics4u.herokuapp.com/home#' +
						querystring.stringify({
							access_token: access_token,
							refresh_token: refresh_token
						})
				);
			} else {
				res.redirect(
					'/#' +
						querystring.stringify({
							error: 'invalid_token'
						})
				);
			}
		});
	}
});

app.get('/playlists', function(req, res) {
	var options = {
		url: `https://api.spotify.com/v1/users/${user_id}/playlists`,
		headers: { Authorization: 'Bearer ' + access_token },
		json: true
	};

	// use the access token to access the Spotify Web API
	request.get(options, function(error, response, body) {
		res.send(body);
		console.log(body);
	});
});

app.get('/refresh_token', function(req, res) {
	// requesting access token from refresh token
	var refresh_token = req.query.refresh_token;
	var authOptions = {
		url: 'https://accounts.spotify.com/api/token',
		headers: { Authorization: 'Basic ' + new Buffer(client_id + ':' + client_secret).toString('base64') },
		form: {
			grant_type: 'refresh_token',
			refresh_token: refresh_token
		},
		json: true
	};

	request.post(authOptions, function(error, response, body) {
		if (!error && response.statusCode === 200) {
			var access_token = body.access_token;
			res.send({
				access_token: access_token
			});
		}
	});
});

console.log('Listening on 8888');
app.listen(process.env.PORT);
