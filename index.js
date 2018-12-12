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

var atrs = function (name, content) {
   return name + "=\"" + content + "\"";
};

//Fonction pour crée les tags
var tag = function (name, attribut, content) {
   return "<" + name + (attribut.length == 0 ? "" : " ") + attribut + ">"
   		  + content + "</"+name+">";
};

var style = function (atrs) {
    return "style=\"" + atrs + "\""; 
};

var creerMatrice = function (rows, cols) {
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

var findPosStock = function (target, stock, pos) {
    for (var i = 0; i < stock.length; i++) {
        if (stock[i].id == target) {
            if (pos == "position") {
                return i;
            } else { // recherche enregistrement
                return stock[i];
            }
        }
    }
    return -1;
};

var tab = function (sondageId, version) {
	
    var sondage = findPosStock(sondageId, stockSondages, "enr");
	
	var dateDebut = sondage.dateDebut;
	var dateFin = sondage.dateFin;
	var heureDebut = sondage.heureDebut.split("h")[0];
	var heureFin = sondage.heureFin.split("h")[0];
	
	var nbDates = joursDiff(dateDebut, dateFin) + 1;
	var nbHeures = +heureFin - +heureDebut + 1;
	
	var tableAtrs 	= atrs("id", "calendrier")
					  +atrs("onmousedown", "onClick(event)")
					  +atrs("onmouseover", "onMove(event)")
					  +atrs("data-nbjours", ""+nbDates)
					  +atrs("data-nbheures", ""+nbHeures);
	
    var matrice = creerMatrice(nbHeures + 1, nbDates + 1);
    
    var barAtrs;
    var noms = listeNoms(sondageId);
	
    return tag("table", (version == "sondage" ? tableAtrs : ""),
    matrice.map(function(rows, i) {
        return tag("tr", "", rows.map(function(cols, j) {
            if (i == 0) {
                if (j == 0) {
                    return tag("th", "", "");
                } else {
                    return tag("th", "", jourAdd(dateDebut, j - 1)[2]+ " "
                           +mois[jourAdd(dateDebut, j - 1)[1] - 1]);
                }
            } else {
                if (j == 0) {
                    return tag("th", "", +heureDebut + i - 1 + "h");
                } else {
                    return tag("td", (version == "sondage" ? cols : ""),
                        (version == "sondage" ? "" :
                        Array(nbPart(sondageId)).fill(0).map(function(x, p) {
                            barAtrs = "background-color:"+stockColor[0][p]
                                    +"; color:"+stockColor[0][p];
                            if (divide(disposPart(noms[p], sondageId), nbHeures)[i-1][j-1]
                            == "1") {
                                return tag("span", style(barAtrs), ".");
                            }
                        }).join(""))
                    );
                }
            }
        }).join(""));
    }).join(""));
};

var getCalendar = function (sondageId) {
    var title = findPosStock(sondageId, stockSondages, "enr").titre;
	var contenu = readFile('template/calendar.html');     // La page HTML
    contenu = contenu.split('{{titre}}').join(title); // Titre
    contenu = contenu.split('{{table}}').join(tab(sondageId, "sondage"));
    contenu = contenu.split('{{url}}').join('http://localhost:1337/'+sondageId);
    return contenu;
};

// Retourne le texte HTML à afficher à l'utilisateur pour voir les
// résultats du sondage demandé
//
// Doit retourner false si le calendrier demandé n'existe pas

var nbPart = function (sondageId) {
    var liste = stockRep;
    var resultat = 0;
    for (var i = 0; i < liste.length; i++) {
        if (liste[i].id == sondageId) {
            resultat += 1;
        }
    }
    return resultat;
};

var listeNoms = function (sondageId) {
    var liste = stockRep;
    var resultat = [];
    for (var i = 0; i < liste.length; i++) {
        if (liste[i].id == sondageId) {
            resultat.push(liste[i].nom);
        }
    }
    return resultat;
};

var disposPart = function (nom, sondageId) {
    var liste = stockRep;
    var resultat = "";
    for (var i = 0; i < liste.length; i++) {
        if (liste[i].id == sondageId
            && liste[i].nom == nom) {
            resultat += liste[i].disponibilites;
        }
    }
    return resultat;
};

var divide = function (dispo, diviseur) {
    var init = dispo.split("");
    var resultat = [];
    var long = init.length / diviseur;
	for (var i = 0; i < diviseur; i++) {
    	resultat.push(init.splice(0, long));
	}
    return resultat;
};

var stockColor = []; // stockages des couleurs

var legende = function (sondageId) {
    var parts = Array(nbPart(sondageId)).fill(0);
    var couleur = parts.map(function(x, i) { return ''
    + genColor(i, nbPart(sondageId)) });
    var atrsLegend;
    var noms = listeNoms(sondageId);
    stockColor.push(couleur);
    
    return tag("ul", "", Array(parts.length).fill(0).map( function(x, p) {
        atrsLegend = "background-color: " + stockColor[0][p];
        return tag("li", style(atrsLegend), noms[p]);
    }).join(""));
};

var getResults = function (sondageId) {
    var title = findPosStock(sondageId, stockSondages, "enr").titre;
    var contenu = readFile('template/results.html');
    
    contenu = contenu.split('{{legende}}').join(legende(sondageId));
    contenu = contenu.split('{{titre}}').join(title);
    contenu = contenu.split('{{table}}').join(tab(sondageId, "resultat"));
    contenu = contenu.split('{{url}}').join('http://localhost:1337/'+sondageId);
    stockColor.pop();
    
    return contenu;
};

// Crée un sondage à partir des informations entrées
//
// Doit retourner false si les informations ne sont pas valides, ou
// true si le sondage a été créé correctement.

var comparer = function (debut, fin) {
    var dateDebut  = new Date(debut).getTime();
    var dateFin    = new Date(fin).getTime();

    if (dateDebut <= dateFin) {
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
        if (findPosStock(id, stockSondages, "position") >= 0) {
            stockSondages.splice(findPosStock(id, stockSondages, "position"), 1);
            stockSondages.push({titre: titre, id: id, dateDebut: dateDebut,
                dateFin: dateFin, heureDebut: heureDebut,
                heureFin: heureFin});
        } else {
	        stockSondages.push({titre: titre, id: id, dateDebut: dateDebut,
                            dateFin: dateFin, heureDebut: heureDebut,
                            heureFin: heureFin});
        }
   	return true;
    }
};

// Ajoute un participant et ses disponibilités aux résultats d'un
// sondage. Les disponibilités sont envoyées au format textuel
// fourni par la fonction compacterDisponibilites() de public/calendar.js
//
// Cette fonction ne retourne rien

var stockRep = [];

var ajouterParticipant = function(sondageId, nom, disponibilites) {
    stockRep.push({id: sondageId, nom: nom,
                   disponibilites: disponibilites});
};

// Génère la `i`ème couleur parmi un nombre total `total` au format
// hexadécimal HTML
//
// Notez que pour un grand nombre de couleurs (ex.: 250), générer
// toutes les couleurs et les afficher devrait donner un joli dégradé qui
// commence en rouge, qui passe par toutes les autres couleurs et qui
// revient à rouge.

var format = function (entier, base) { // nombre a hexadecimal
    var n = Math.floor(entier);
    var resultat = "";
    do {
        resultat = n % base + resultat;
        n = Math.floor(n / base);
    } while (n > 0);
    resultat = resultat.split("10").join("A");
    resultat = resultat.split("11").join("B");
    resultat = resultat.split("12").join("C");
    resultat = resultat.split("13").join("D");
    resultat = resultat.split("14").join("E");
    resultat = resultat.split("15").join("F");
    if (resultat.length == 1) {
        resultat = "0" + resultat;
    }
    return resultat;
};

var genColor = function(i, nbTotal) {

    var resultat = [];
    var teinte = (i / nbTotal) * 360;
    var h = teinte / 60;
    var c = 0.7;
    var x = c * (1 - Math.abs(h % 2 - 1));

    switch (Math.floor(h)) {
        case 0: resultat.push(c, x, 0); break;
        case 1: resultat.push(x, c, 0); break;
        case 2: resultat.push(0, c, x); break;
        case 3: resultat.push(0, x, c); break;
        case 4: resultat.push(x, 0, c); break;
        case 5: resultat.push(c, 0, x); break;
        default: resultat.push(0, 0, 0);
    }
    // retourne resultat en format ["RR", "GG", "BB"].
    resultat = resultat.map(function(x) { return format(x*255, 16); });
    // retourne resultat en format "#RRGGBB".
    resultat = resultat.reduce(function(x, y) { return x + y; }, "#");
    return resultat;
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
