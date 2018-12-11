'use strict';

var http = require("http");
var fs = require('fs');
var urlParse = require('url').parse;
var pathParse = require('path').parse;
var querystring = require('querystring');

var port = 1337;
var hostUrl = 'http://localhost:'+port+'/';
var defaultPage = '/index.html';

var mimes = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'text/javascript',
};

// --- Helpers ---
var readFile = function (path) {
    return fs.readFileSync(path).toString('utf8');
};

var writeFile = function (path, texte) {
    fs.writeFileSync(path, texte);
};

// --- Server handler ---
var redirect = function (reponse, path, query) {
    var newLocation = path + (query == null ? '' : '?' + query);
    reponse.writeHeader(302, {'Location' : newLocation });
    reponse.end('302 page déplacé');
};

var getDocument = function (url) {
    var pathname = url.pathname;
    var parsedPath = pathParse(url.pathname);
    var result = { data: null, status: 200, type: null };

    if(parsedPath.ext in mimes) {
        result.type = mimes[parsedPath.ext];
    } else {
        result.type = 'text/plain';
    }

    try {
        result.data = readFile('./public' + pathname);
        console.log('['+new Date().toLocaleString('iso') + "] GET " + url.path);
    } catch (e) {
        // File not found.
        console.log('['+new Date().toLocaleString('iso') + "] GET " +
                    url.path + ' not found');
        result.data = readFile('template/error404.html');
        result.type = 'text/html';
        result.status = 404;
    }

    return result;
};
var sendPage = function (reponse, page) {
    reponse.writeHeader(page.status, {'Content-Type' : page.type});
    reponse.end(page.data);
};

var indexQuery = function (query) {

    var resultat = { exists: false, id: null };

    if (query !== null) {

        query = querystring.parse(query);
        if ('id' in query && 'titre' in query &&
            query.id.length > 0 && query.titre.length > 0) {

            resultat.exists = creerSondage(
                query.titre, query.id,
                query.dateDebut, query.dateFin,
                query.heureDebut, query.heureFin);
        }

        if (resultat.exists) {
            resultat.id = query.id;
        }
    }

    return resultat;
};

var calQuery = function (id, query) {
    if (query !== null) {
        query = querystring.parse(query);
        // query = { nom: ..., disponibilites: ... }
        ajouterParticipant(id, query.nom, query.disponibilites);
        return true;
    }
    return false;
};

var getIndex = function (replacements) {
    return {
        status: 200,
        data: readFile('template/index.html'),
        type: 'text/html'
    };
};


// --- À compléter ---

var mois = [
    'Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin',
    'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Dec'
];

var MILLIS_PAR_JOUR = (24 * 60 * 60 * 1000);

// Retourne le texte HTML à afficher à l'utilisateur pour répondre au
// sondage demandé.
//
// Doit retourner false si le calendrier demandé n'existe pas

//Tableaux crée de n elements. Ses éléments sont ensuite remplis de 0 pour
//ne pas être undefined. Ce tableau utilise les fonction map et des itterations
//de i pour les "tr" et j pour les "td" pour y inserer des valeurs.

var atrs = function (name, content){
   return name + "=\"" + content + "\"";
};

//Fonction pour crée les tags
var tag = function (name, attribut, content){
   return "<" + name + (attribut.length == 0 ? "" : " ") + attribut + ">"
   		  + content + "</"+name+">";
};

var style = function (proprietes) {
    return "style=\"" + proprietes + "\"";
};

var matrice = function (rows, cols){
    return Array(rows).fill(0).map(function (y, i) {
        return Array(cols).fill(0).map(function(x, j){
            return atrs("id", (i-1) +"-"+ (j-1));
        });
    });
};

var jourAdd = function (texte, i) {
    var date = new Date(texte.split("-")).getTime();
    date += i * (3600 * 24 * 1000); // add days
	
    var dateYear   = new Date(date).getFullYear();
    var dateMonth  = new Date(date).getMonth() + 1; // starts at 0
    var dateDay    = new Date(date).getDate();
	
    var currentDay = [dateYear, dateMonth, dateDay];
    return currentDay;
};

var initPage = 0; // instances du sondages, chaques nouveau augmente le nombre
var initDay = 0;
var initMonth = 0;

var table = function () {
	
    var chercherSondage = stockSondages[initPage++];
	
	var dateDebut = chercherSondage.dateDebut;
	var dateFin = chercherSondage.dateFin;
	var heureDebut = chercherSondage.heureDebut.split("h")[0];
	var heureFin = chercherSondage.heureFin.split("h")[0];
	
	var nbDates = joursDiff(dateDebut, dateFin) + 1;
	var nbHeures = +heureFin - +heureDebut + 1;
	
	var tableAtrs 	= atrs("id", "calendrier")
					  +atrs("onmousedown", "onClick(event)")
					  +atrs("onmouseover", "onMove(event)")
					  +atrs("data-nbjours", ""+nbDates)
					  +atrs("data-nbheures", ""+nbHeures);
	
	var matrice = creerMatrice(nbHeures + 1, nbDates + 1);
	
  	return tag("table", tableAtrs, matrice.map(function(rows, i) {
       	return tag("tr", "", rows.map(function(cols, j) {
            if (i == 0) {
		    	if (j == 0) {
			    	return tag("th", "", "");
				} else {
                	return tag("th", "", jourAdd(dateDebut, initDay++));
				}
            } else {
                if (j == 0) {
                    return tag("th", "", heureDebut++ + "h");
                } else {
            		return tag("td", cols, "");
                }
            }
        }).join(""));
    }).join(""));
};

var getCalendar = function (sondageId) {
	var contenu = readFile('template/calendar.html');     // La page HTML
    contenu = contenu.split('{{titre}}').join(sondageId); // Titre
    contenu = contenu.split('{{table}}').join(table());
    contenu = contenu.split('{{url}}').join('http://localhost:1337/'+sondageId);
    return contenu;
};

// Retourne le texte HTML à afficher à l'utilisateur pour voir les
// résultats du sondage demandé
//
// Doit retourner false si le calendrier demandé n'existe pas
var getResults = function (sondageId) {
    // TODO
    return 'Resultats du sondage <b>' + sondageId + '</b> (TODO)';
};

// Crée un sondage à partir des informations entrées
//
// Doit retourner false si les informations ne sont pas valides, ou
// true si le sondage a été créé correctement.

var comparer = function (x, y) {
    var tableauDebut  = x.split("-");
    var tableauFin    = y.split("-");

    if ((tableauDebut[0] <= tableauFin[0])
        && (tableauDebut[1] <= tableauFin[1])
        && (tableauDebut[2] <= tableauFin[2])) {
      	return true;
    } else {
		return false;
	}
};

var joursDiff = function (debut, fin) {
    var dateDebut = new Date(debut.split("-"));
    var dateFin   = new Date(fin.split("-"));
    var tempsDiff = dateFin.getTime() - dateDebut.getTime(); // retour en millisecondes
    var joursDiff = tempsDiff / (3600 * 24 * 1000);  // division pour remettre en jours
    return joursDiff;
};

var carPermis = function (texte) {
	for (var i = 0; i < texte.length; i++) {
    	if ((texte[i] >= "a" && texte[i] <= "z")
            || (texte[i] >= "A" && texte[i] <= "z")
            || (parseInt(texte[i]) >= 0)
            || texte[i] == "-") {
            continue;
        } else {
            return false;
        }
    }
    return true;
};

var stockSondages = [];

var creerSondage = function(titre, id, dateDebut, dateFin, heureDebut, heureFin) {

    var heureDebutConverti = +heureDebut.slice(0, heureDebut.length-1);
    var heureFinConverti = +heureFin.slice(0, heureFin.length-1);
    
    if ((!carPermis(id))
        || (!comparer(dateDebut, dateFin))
        || (!(heureDebutConverti <= heureFinConverti))
        || (!(joursDiff(dateDebut, dateFin) <= 30))) { // Les caracteres permis
        return false;
    } else {
	stockSondages.push({titre: titre, id: id, dateDebut: dateDebut,
                            dateFin: dateFin, heureDebut: heureDebut,
                            heureFin: heureFin});
   	return true;
    }
};

// Ajoute un participant et ses disponibilités aux résultats d'un
// sondage. Les disponibilités sont envoyées au format textuel
// fourni par la fonction compacterDisponibilites() de public/calendar.js
//
// Cette fonction ne retourne rien
var ajouterParticipant = function(sondageId, nom, disponibilites) {
    // TODO
};

// Génère la `i`ème couleur parmi un nombre total `total` au format
// hexadécimal HTML
//
// Notez que pour un grand nombre de couleurs (ex.: 250), générer
// toutes les couleurs et les afficher devrait donner un joli dégradé qui
// commence en rouge, qui passe par toutes les autres couleurs et qui
// revient à rouge.
var genColor = function(i, nbTotal) {
    // TODO
    return '#000000';
};


/*
 * Création du serveur HTTP
 * Note : pas besoin de toucher au code ici (sauf peut-être si vous
 * faites les bonus)
 */
http.createServer(function (requete, reponse) {
    var url = urlParse(requete.url);

    // Redirect to index.html
    if (url.pathname == '/') {
        redirect(reponse, defaultPage, url.query);
        return;
    }

    var doc;

    if (url.pathname == defaultPage) {
        var res = indexQuery(url.query);

        if (res.exists) {
            redirect(reponse, res.id);
            return;
        } else {
            doc = getIndex(res.data);
        }
    } else {
        var parsedPath = pathParse(url.pathname);

        if (parsedPath.ext.length == 0) {
            var id;

            if (parsedPath.dir == '/') {
                id = parsedPath.base;

                if (calQuery(id, url.query)) {
                    redirect(reponse, '/'+ id + '/results')
                    return ;
                }

                var data = getCalendar(id);

                if(data === false) {
                    redirect(reponse, '/error404.html');
                    return;
                }

                doc = {status: 200, data: data, type: 'text/html'};
            } else {
                if (parsedPath.base == 'results') {
                    id = parsedPath.dir.slice(1);
                    var data = getResults(id);

                    if(data === false) {
                        redirect(reponse, '/error404.html');
                        return;
                    }

                    doc = {status: 200, data: data, type: 'text/html'};
                } else {
                    redirect(reponse, '/error404.html');
                    return;
                }
            }
        } else {
            doc = getDocument(url);
        }
    }

    sendPage(reponse, doc);

}).listen(port);
