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

// stock des couleurs
var stockColor = [];
// stock des sondages crees
var stockSondages = [];
// stock des reponses aux sondages
var stockRep = [];

// fonction cree des attributs
var atrs = function (name, content) {
    return name + "=\"" + content + "\"";
};

// fonction cree des tags
var tag = function (name, attribut, content) {
    return "<" + name + (attribut.length == 0 ? "" : " ") + attribut + ">"
    + content + "</"+name+">";
};

// fonction cree des styles pour modifier les balises
var style = function (atrs) {
    return "style=\"" + atrs + "\"";
};

// fonction cree un tableau de tableaux, associe un id aux cases
var creerMatrice = function (rows, cols) {
    return Array(rows).fill(0).map(function (y, i) {
        return Array(cols).fill(0).map(function(x, j) {
            return atrs("id", (i - 1) + "-" + (j - 1));
        });
    });
};

// fonction prend en parametre une date en format "YYYY-MM-DD" et l'index
// parmis une liste de toute les dates que le participant peut choisir
var jour = function (texte, i) {
    // temps en millisecondes depuis le 1e janvier 1970
    var date = new Date(texte.split("-")).getTime();
    // ajoute un nombre i de jour a la date du debut
    date += i * (3600 * 24 * 1000);
    // annee, mois et jour de la nouvelle date en nombre
    var dateYear   = new Date(date).getFullYear();
    var dateMonth  = new Date(date).getMonth() + 1; // commence a 0
    var dateDay    = new Date(date).getDate();
    var newDate = [dateYear, dateMonth, dateDay];
    // nouvelle date retournee dans un tableau
    return newDate;
};

// Fonction retourne prend en parametre l'id recherche, le stock de donnees et
// le comportement attendu de la fonction. Si on recherche la position de l'id
// dans le stock, il retournera son index. Si non, il retournera son contenu.
var find = function (targetId, stock, behavior) {
    for (var i = 0; i < stock.length; i++) {
        if (stock[i].id == targetId) {
            if (behavior == "position") {
                return i;
            } else {
                return stock[i];
            }
        }
    }
    // id n'existe pas dans le stock recherche
    return -1;
};

// Fonction retourne la valeur de la classe de la table des resultats. Elle
// prend en parametre l'id du sondage, le nbHeures du calendrier et l'index
// d'une case de la matrice du calendrier.
var valeurClass = function (sondageId, nbHeures, i, j) {
    // tableau avec toutes les disponibilites des participants du sondage id
    var allPartsDipos = tabDesParts(sondageId);
    // chaque "0" et "1" est attribue a une case de la matrice du calendrier
    var allPartsDisposTab = allPartsDipos.map(function(texte) {
                                return divide(texte, nbHeures);
                            });
    // nouvelle matrice avec le total des dispos de toutes les participants
    // dans chaque case de la matrice du calendrier, respectivement
    var sumDisposTab = allPartsDisposTab.reduce(sumDispos);
    // la plus petite et la plus grande valeure de la matrice des sommes des
    // dispos
    var min = minMax(sumDisposTab)[0], max = minMax(sumDisposTab)[1];
    // comparaison de min et max avec la valeur presente de la matrice
    switch (sumDisposTab[i - 1][j - 1]) {
        case min: return "min"; break;
        case max: return "max"; break;
        default: return "";
    }
};

var getData = function (sondageId) {
    // on recherche l'enregistrement du stock de sondages qui contient l'id
    // sondageId
    var sondageData = find(sondageId, stockSondages, "data");
    // enumeration des donnees de l'enregistrements
	var dateDebut  = sondageData.dateDebut;
	var dateFin    = sondageData.dateFin;
	var heureDebut = sondageData.heureDebut.split("h")[0];
    var heureFin   = sondageData.heureFin.split("h")[0];
    // nbDates et nbHeures du sondage cree
	var nbDates  = joursDiff(dateDebut, dateFin) + 1;
    var nbHeures = heureDiff(heureDebut, heureFin) + 1;
    // retourne donnees utiles
    return [nbHeures, nbDates, heureDebut, dateDebut];
};

var tab = function (sondageId, version) {
    // creation du calendrier en matrice	
	var dateDebut  = getData(sondageId)[3];
	var heureDebut = getData(sondageId)[2];
	var nbDates    = getData(sondageId)[1];
    var nbHeures   = getData(sondageId)[0];
    var calendrier = creerMatrice(nbHeures + 1, nbDates + 1);
	// attributs desires de la table
	var tableAtrs 	= atrs("id", "calendrier")
					  + atrs("onmousedown", "onClick(event)")
					  + atrs("onmouseover", "onMove(event)")
					  + atrs("data-nbjours", "" + nbDates)
					  + atrs("data-nbheures", "" + nbHeures);
    // attributs de la barre de couleur
    var barAtrs;
    // disponibilites d'un participant a une certaine date
    var disposParTab;
    var noms = listeNoms(sondageId);

    return tag("table",
    (version == "sondage" ? tableAtrs : ""),
    calendrier.map(function(rows, i) {
        // colonne du tableau
        return tag("tr", "", rows.map(function(cols, j) {
            // premiere colonne...
            if (i == 0) {
                // premier element...
                if (j == 0) {
                    // case sans contenu
                    return tag("th", "", "");
                // ... autres elements
                } else {
                    // dates proposees pour l'evenement
                    return tag("th", "",
                    // jour
                    jour(dateDebut, j - 1)[2] + " "
                    // mois (index commence par 0)
                    + mois[jour(dateDebut, j - 1)[1] - 1]);
                }
            // ... autres colonnes
            } else {
                // premier element...
                if (j == 0) {
                    // heures proposees pour l'evenement
                    return tag("th", "", +heureDebut + i - 1 + "h");
                // ... autres elements
                } else {
                    // cases selectionnables du calendrier
                    return tag("td",
                    // attribut est soit l'id de la case selectionnable
                    // ou une class entre min, max et aucune valeur
                    (version == "sondage" ? cols : atrs("class",
                    valeurClass(sondageId, nbHeures, i, j))),
                    // contenu entre les balises est vide...
                    (version == "sondage" ? "" :
                    // ou contient les barres de couleur
                    // tous les participants peuvent avoir une barre dans
                    // chaque case
                    Array(nbPart(sondageId)).fill(0).map(function(x, p) {
                        // couleur assignee a participant p
                        barAtrs = "background-color:" + stockColor[0][p]
                        + "; color:" + stockColor[0][p];
                        // dispos de p avec la meme forme que le calendrier
                        disposParTab = divide(disposPart(noms[p], sondageId),
                        nbHeures)
                        if (disposParTab[i - 1][j - 1] == "1") {
                            // affiche barre sur ses dates choisies
                            return tag("span", style(barAtrs), ".");
                        }
                    }).join(""))
                    );
                }
            }
        }).join(""));
    }).join(""));
};

// retourne le texte HTML a affhicher a l'utilisateur pour repondre au
// sondage cree
var getCalendar = function (sondageId) {
    // titre du sondage
    var title = find(sondageId, stockSondages, "enr").titre;
    // contenu de la page HTML template
    var contenu = readFile('template/calendar.html');
    // implementation du titre
    contenu = contenu.split('{{titre}}').join(title);
    // implementation du calendrier du sondage
    contenu = contenu.split('{{table}}').join(tab(sondageId, "sondage"));
    // implementation de l'url
    contenu =
    contenu.split('{{url}}').join('http://localhost:1337/' + sondageId);
    // retour du contenu modifie
    return contenu;
};

// retourne le nombre de participants qui ont repondu au sondageId
var nbPart = function (sondageId) {
    // appel au stock de reponses des participants (enregistrements)
    var liste = stockRep;
    // aucun participants au depart
    var resultat = 0;
    for (var i = 0; i < liste.length; i++) {
        if (liste[i].id == sondageId) {
            resultat += 1;
        }
    }
    return resultat;
};

// retourne la liste des noms de toutes les participants du sondageId
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

// retourne les disponibilites d'un participant pour le sondageId
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

// retourne un tableau avec toutes les disponibilites des participants pour
// sondageId
var tabDesParts = function (sondageId) {
    var liste = stockRep;
    var resultat = [];
    for (var i = 0; i < liste.length; i++) {
        if (liste[i].id == sondageId) {
            resultat.push(liste[i].disponibilites);
        }
    }
    return resultat;
};

// retourne une matrice ou chaques elements est la somme des elements entre
// 2 matrices, respectivement
var sumDispos = function (matrice1, matrice2) {
    for (var i = 0; i < matrice1.length; i++) {
        for (var j = 0; j < matrice1[i].length; j++) {
            matrice1[i][j] = +matrice1[i][j] + +matrice2[i][j];
        }
    }
    return matrice1;
};

// retourne la valeur minimale et maximale des elements d'une matrice
var minMax = function(matrice) {
    var min = Infinity;
    var max = 0;
    for (var i = 0; i < matrice.length; i++) {
        for (var j = 0; j < matrice[i].length; j++) {
            if (matrice[i][j] < min) {
                min = matrice[i][j];
            }
            if (matrice[i][j] > max) {
                max = matrice[i][j];
            }
        }
    }
    return [min, max];
};

// prend en parametre un string et retourne une matrice avec diviseur elements
// ou chaques elements contient une partie du string divisee equitablement
var divide = function (texte, diviseur) {
    var array = texte.split("");
    var resultat = [];
    var longueur = array.length / diviseur;
	for (var i = 0; i < diviseur; i++) {
    	resultat.push(array.splice(0, longueur));
	}
    return resultat;
};

// cree la legende de la page des resultats
var legende = function (sondageId) {
    // couleur pour chaques participants du sondageId
    var parts = Array(nbPart(sondageId)).fill(0);
    var couleur = parts.map(function(x, i) {
        return "" + genColor(i, nbPart(sondageId));
    });
    // attributs de la legende
    var atrsLegende;
    var noms = listeNoms(sondageId);
    // stock le tableau contenant les couleurs
    stockColor.push(couleur);
    // cree une liste ou chaque couleur est associee aux participants
    return tag("ul", "", Array(parts.length).fill(0).map( function(x, p) {
        atrsLegende = "background-color: " + stockColor[0][p];
        return tag("li", style(atrsLegende), noms[p]);
    }).join(""));
};

// retourne le texte HTML a afficher pour la page des resultats de sondageId
var getResults = function (sondageId) {
    // titre du sondage
    var title = find(sondageId, stockSondages, "enr").titre;
    // contenu de la page HTML template
    var contenu = readFile('template/results.html');
    // implementation de la legende
    contenu = contenu.split('{{legende}}').join(legende(sondageId));
    // implementation du titre
    contenu = contenu.split('{{titre}}').join(title);
    // implementation de la table de resultats
    contenu = contenu.split('{{table}}').join(tab(sondageId, "resultat"));
    // implementation de l'url
    contenu = contenu.split('{{url}}').join('http://localhost:1337/'+sondageId);
    // clear le stock des couleurs pour prochaine utilisation
    stockColor = [];
    // retourne le texte HTML a l'utilisateur
    return contenu;
};

// fonction prend en parametre deux dates de format "YYYY-MM-DD" et s'assure
// que la premiere est plus petite ou egale a la deuxieme. retourne true si
// bien ecrite.
var comparerDate = function (debut, fin) {
    // temps en millisecondes depuis le 1e janvier 1970
    var dateDebut  = new Date(debut).getTime();
    var dateFin    = new Date(fin).getTime();

    if (dateDebut <= dateFin) {
      	return true;
    } else {
		return false;
	}
};

// fonction prend en parametre deux dates de format "YYYY-MM-DD" et calcule
// la difference de jour qui les separent
var joursDiff = function (debut, fin) {
    var dateDebut = new Date(debut.split("-"));
    var dateFin   = new Date(fin.split("-"));
    var tempsDiff = dateFin.getTime() - dateDebut.getTime();
    // division pour remettre millisecondes en journees
    var joursDiff = tempsDiff / (3600 * 24 * 1000);
    
    return joursDiff;
};

// fonction prend en parametre deux heures de format "#h" ou "##h" et calcule
// la difference d'heure qui les separent
var heureDiff = function (debut, fin) {
    var hourDebut = +debut.split('h')[0];
    var hourFin = +fin.split('h')[0];
    var hourDiff = hourFin - hourDebut;
    return hourDiff;
};

// fonction verifie si le texte en parametre contient des caracteres autorises
var carPermis = function (texte) {
	for (var i = 0; i < texte.length; i++) {
        // lettre minuscule
        if ((texte[i] >= "a" && texte[i] <= "z")
        // lettre majuscule
        || (texte[i] >= "A" && texte[i] <= "z")
        // chiffre
        || (parseInt(texte[i]) >= 0 && parseInt(texte[i]) <= 9)
        // tiret
        || texte[i] == "-") {
            continue;
        } else {
            return false;
        }
    }
    return true;
};

// fonction cree les calendrier de sondages pour les participants
var creerSondage =
function (titre, id, dateDebut, dateFin, heureDebut, heureFin) {
    // verifie si les informations rentrees sont valides.
    // caracteres autorises
    if ((!(carPermis(id)))
    // dates et heures logiques
    || (!(comparerDate(dateDebut, dateFin)))
    || (!(heureDiff(heureDebut, heureFin) >= 0))
    || (!(joursDiff(dateDebut, dateFin) <= 30))) {
        return false;
    } else {
        // id est deja existant dans le stock de sondages
        if (find(id, stockSondages, "position") >= 0) {
            return false;
        } else {
            // stock informations en enregistrement
	        stockSondages.push({ titre: titre, id: id, dateDebut: dateDebut,
            dateFin: dateFin, heureDebut: heureDebut, heureFin: heureFin });
        }
   	return true;
    }
};

// fonction verifie l'existence d'un nom dans le stock des reponses au sondageId
var existenceNom = function (sondageId, nom) {
    var liste = stockRep;
    for (var i = 0; i < liste.length; i++) {
        if (liste[i].id == sondageId
            && liste[i].nom == nom) {
            return true
        }
    }
    return false;
};

// Ajoute un participant et ses disponibilités aux résultats d'un
// sondage. Les disponibilités sont envoyées au format textuel
// fourni par la fonction compacterDisponibilites() de public/calendar.js
var ajouterParticipant = function (sondageId, nom, disponibilites) {
    // si nom existe deja, un numero sera ajoute apres le nom
    // ex : John devient John2
    if (existenceNom(sondageId, nom)) {
        var newName;
        var i = 2;
        do {
            newName = nom + i;
            i++;
        } while(existenceNom(sondageId, newName));
        stockRep.push({ id: sondageId, nom: newName,
        disponibilites: disponibilites });
    } else {
        stockRep.push({ id: sondageId, nom: nom,
        disponibilites: disponibilites });
    }
};

// Génère la `i`ème couleur parmi un nombre total `total` au format
// hexadécimal HTML
//
// Notez que pour un grand nombre de couleurs (ex.: 250), générer
// toutes les couleurs et les afficher devrait donner un joli dégradé qui
// commence en rouge, qui passe par toutes les autres couleurs et qui
// revient à rouge.
var hexConvert = function (number) {
    var resultat = number;
    var target;
    var char;
    // prend en parametre les nbs du string et le retourne en lettrage
    for (var i = 0; i < 6; i++ ) {
        target = 10 + i + "";
        char = String.fromCharCode(65 + i);
        if (number.indexOf(target) >= 0) {
    		resultat = resultat.split(target).join(char);
        }
    }
    // les resultats seront de ce format "##"
    if (resultat.length == 1) {
        resultat = "0" + resultat;
    }
	return resultat;
};

var format = function (entier, base) { // nombre a hexadecimal
    var n = Math.floor(entier);
    var resultat = "";

    do {
        resultat = n % base + resultat;
        n = Math.floor(n / base);
    } while (n > 0);
    // convertit le nb hexadecimal (ex: "1515") en bon caractere (ex: "FF").
    resultat = hexConvert(resultat);
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
