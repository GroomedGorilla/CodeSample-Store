# MyStore - A Node.js E-Commerce Platform built on Express

This codebase is intended as a Node.js code sample. The project consists of two separate folders:

 1. `mystore-core` is the project itself (more details below)
 2. `mystore-docker-compose` is the docker-compose setup for the project as it would be on a server hosting the main project (not running locally)

## Project Description & Structure

This application is intended to be an online e-commerce platform for the sale of digital goods, primarily audio content. Users can register an account and can use the site as a customer, admin or content creator (pending registration and verification through Stripe Connect). 

 - Users can preview files and purchase content which will then permanently be linked to their account (meaning any updates by creators will be applied to the products purchased). Owned content can be downloaded.
 - Content Creators can upload files, manage their content (change names, prices, keywords etc.), and receive a percentage of sales for their content (minus Stripe charge and platform fee).
 - Admins have the same privileges as content creators but may also access the job queue, see a list of all files and more.

The project has has been built as an Express application using Node.js. The different components of the application have been "Dockerised" into containers for the database, server application and job queue. The different containers are tied together and managed using Docker-Compose. The entire application is run within a PM2 instance which runs the necessary initialisation and ensures the application remains live.

## Project Components:

 - Database
	 - MySQL + [Knex](http://knexjs.org/) Migrations + [Bookshelf.js ORM](https://bookshelfjs.org/)
	 - Includes tables for users, products (sounds), user sessions, relational tables, keywords and more
- File Storage
	- Files stored on AWS S3
	- Uploaded to S3 bucket via FineUploader
- Audio Watermarking on the backend
	- Watermarked files used for previews before purchase
	- Managed by [Kue](https://github.com/Automattic/kue) job queue, running on Redis
	- Tasks created on upload, watermarking done server-side via Ffmpeg child process
	- Files uploaded to separate 'preview' bucket on Amazon S3
- User Management
	- Account creation, validation, password reset, forgotten password, update & deletion
	- Uses [Passport.js](http://www.passportjs.org/) Local Strategy
	- Account validation & critical changes/updates confirmed via email + verification tokens
- UI
	- [EJS](https://ejs.co/) Templates
	- Audio playback via Amazon S3 using [WaveSurfer](https://wavesurfer-js.org/)
- Email API : [Mailgun](https://www.mailgun.com/)
- Payments
	- [Stripe](https://stripe.com/gb) for accepting payments
	- [Stripe Connect](https://stripe.com/gb/connect) for setting up the platform and paying creators their portion of their earnings

## DevOps

The project is split into [Docker](https://www.docker.com/) containers for:
 1. The Store Application (`mystore`)
 2. MySQL (`mysql`)
 3. Redis (`redis`)
with volumes for the MySql and Redis data
 
 The three containers are linked via [Docker Compose](https://docs.docker.com/compose/) and run within a [PM2](https://pm2.keymetrics.io/) instance.

[Nginx](https://www.nginx.com/) configuration & a [LetsEncrypt](https://letsencrypt.org/) setup (+ automated certificate renewal) are included in the project. 

Project initialisation follows the order below:

 1. `docker-compose.yml` - calls the individual Dockerfiles for each image/container
 2. Dockerfile (`mystore-core/Dockerfile`) for the store application. This runs the `docker-entrypoint.sh` script, which runs the Knex migrations and calls the `start-docker` script
 3. `package.json` -> `start-docker` script starts the application within PM2, using the configuration in`pm2_configs/config.json` 

## Running the Application

The application was put together such that the project containers could be build and spun up without prior environment setup on the local machine (save for the notes below).

To run the application, use the following commands in the `mystore-core` folder:

    docker-compose build
    docker-compose up
or

    docker-compose up --build
to build containers and run the application in one command.

Once setup completes (images downloaded, containers created and application run), the application will be running at [localhost:8080](http://localhost:8080).

### Note:
- > Pre-Requisites (on local machine): Node.js, Docker

 - > The keys for the various APIs and services used in this project have
   > been removed. Swapping them out for valid ones relating to your own
   > accounts should work.
- > Since the Mailgun key has been excluded, email verifications will not be sent. Without this step a user account cannot be successfully created and verified for login

 
