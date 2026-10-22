// names.js — opponent name pools by nationality (first names, surnames)

// Game mode, read once at load: 'player' (your own career) or 'coach' (Coach Mode). Coach Mode keeps its saves under
// their own keys (tourlife.coach.*), so switching modes can never touch a player career. Switching reloads the page.
const TL_MODE = (() => { try { return localStorage.getItem('tourlife.mode') === 'coach' ? 'coach' : 'player'; } catch { return 'player'; } })();
const TL_NS = TL_MODE === 'coach' ? 'tourlife.coach.' : 'tourlife.';
const isCoachMode = () => TL_MODE === 'coach';

const FAMILY_FIRST = new Set(['CHN', 'KOR']);

const NAMES = {
  ARG: [['Mateo','Facundo','Tomás','Juan Pablo','Nicolás','Agustín','Santiago','Lautaro','Franco','Gonzalo','Ignacio','Bautista'],
        ['Fernández','Gómez','Sosa','Romero','Acosta','Benítez','Medina','Herrera','Aguirre','Ledesma','Ríos','Cabrera']],
  AUS: [['Jack','Liam','Tom','Harrison','Lachlan','Riley','Cooper','Mitchell','Josh','Blake','Hayden','Jordan'],
        ['Walsh','Mitchell','Kelly','Harris','Bennett','Doyle','Hughes','Fletcher','Ryan','Carter','Cameron','Gallagher']],
  AUT: [['Lukas','Florian','Maximilian','Tobias','Jakob','Sebastian','Matthias','David','Fabian','Philipp'],
        ['Gruber','Huber','Bauer','Wagner','Pichler','Steiner','Moser','Hofer','Leitner','Eder','Brunner','Lang']],
  BEL: [['Lucas','Arthur','Thibault','Pieter','Jonas','Maxime','Simon','Wout','Romain','Jens','Kobe','Louis'],
        ['Peeters','Janssens','Maes','Jacobs','Willems','Dubois','Lambert','Claes','Wouters','Martens','Lemaire','Dupont']],
  BRA: [['João','Gabriel','Pedro','Lucas','Thiago','Rafael','Gustavo','Felipe','Matheus','Vinícius','Caio','Leonardo'],
        ['Silva','Santos','Oliveira','Souza','Pereira','Lima','Carvalho','Ribeiro','Almeida','Costa','Barbosa','Rocha']],
  BUL: [['Georgi','Dimitar','Ivan','Nikolay','Stefan','Martin','Aleksandar','Viktor','Hristo','Petar'],
        ['Ivanov','Georgiev','Dimitrov','Petrov','Nikolov','Todorov','Stoyanov','Kolev','Angelov','Marinov']],
  CAN: [['Liam','Ethan','Félix','Nathan','Owen','Gabriel','Logan','Mathieu','Ryan','Samuel','Alexis','Noah'],
        ['Tremblay','Gagnon','Roy','Côté','Campbell','MacDonald','Bouchard','Morin','Fraser','Gauthier','Stewart','Pelletier']],
  CHI: [['Benjamín','Vicente','Cristóbal','Matías','Diego','Joaquín','Sebastián','Felipe','Alonso','Tomás'],
        ['González','Muñoz','Rojas','Díaz','Soto','Contreras','Silva','Morales','Fuentes','Valenzuela','Araya','Espinoza']],
  CHN: [['Wei','Hao','Jun','Yifan','Zhen','Tian','Bowen','Yuxuan','Lei','Chenxi','Kai','Ming'],
        ['Wang','Li','Zhang','Liu','Chen','Yang','Zhao','Huang','Zhou','Wu','Xu','Sun']],
  COL: [['Santiago','Juan Sebastián','Andrés','Camilo','Daniel','Nicolás','Alejandro','Felipe','Esteban','Mateo'],
        ['Rodríguez','Martínez','García','López','Gómez','Hernández','Moreno','Jiménez','Vargas','Castro','Ospina','Restrepo']],
  CRO: [['Luka','Ivan','Marko','Ante','Josip','Matej','Filip','Mateo','Dino','Nikola'],
        ['Horvat','Kovačević','Babić','Marić','Jurić','Novak','Knežević','Vuković','Petrović','Matić','Perić','Pavlović']],
  CZE: [['Jakub','Tomáš','Jan','Ondřej','Lukáš','Vojtěch','Matěj','Adam','Petr','Filip'],
        ['Novák','Svoboda','Dvořák','Černý','Procházka','Kučera','Veselý','Horák','Němec','Pokorný','Marek','Růžička']],
  DEN: [['Mads','Rasmus','Frederik','Oliver','Emil','Mikkel','Magnus','Jonas','Christian','Anders'],
        ['Jensen','Nielsen','Hansen','Pedersen','Andersen','Larsen','Sørensen','Rasmussen','Kristensen','Madsen']],
  EGY: [['Mohamed','Ahmed','Omar','Youssef','Karim','Mostafa','Amr','Hassan','Ziad','Seif','Adham','Marwan'],
        ['Hassan','Mahmoud','Ibrahim','Abdelaziz','Fahmy','El Sayed','Mansour','Khalil','Farouk','Nasser','Saleh','Shawky']],
  ESP: [['Pablo','Álvaro','Carlos','Javier','Daniel','Adrián','Sergio','Alejandro','Jaume','Iván','Marc','Hugo'],
        ['García','Martínez','López','Sánchez','Pérez','Gómez','Ruiz','Navarro','Moreno','Torres','Vidal','Serrano']],
  FIN: [['Eero','Otto','Aleksi','Mikko','Juho','Ville','Lauri','Niko','Joonas','Elias'],
        ['Korhonen','Virtanen','Mäkinen','Nieminen','Laine','Heikkinen','Koskinen','Järvinen','Lehtonen','Salonen']],
  FRA: [['Hugo','Lucas','Théo','Antoine','Mathis','Clément','Maxime','Quentin','Arthur','Enzo','Valentin','Corentin'],
        ['Martin','Bernard','Dubois','Thomas','Robert','Petit','Durand','Leroy','Moreau','Laurent','Girard','Fournier']],
  GBR: [['Oliver','Harry','George','Jack','James','Charlie','Alfie','Sam','Callum','Finlay','Rhys','Euan'],
        ['Smith','Jones','Taylor','Brown','Wilson','Evans','Thomson','Roberts','Walker','Wright','Hughes','Campbell']],
  GER: [['Leon','Lukas','Jonas','Felix','Niklas','Moritz','Tim','Jan','Paul','Julian','Max','Elias'],
        ['Müller','Schmidt','Schneider','Fischer','Weber','Meyer','Wagner','Becker','Schulz','Hoffmann','Koch','Richter']],
  GRE: [['Georgios','Dimitrios','Nikolaos','Konstantinos','Ioannis','Alexandros','Panagiotis','Christos','Vasileios','Michail'],
        ['Papadopoulos','Nikolaidis','Georgiou','Konstantinidis','Dimitriou','Pappas','Karagiannis','Vlachos','Antoniou','Oikonomou']],
  HUN: [['Bence','Máté','Dávid','Levente','Balázs','Ádám','Gergő','Zsombor','Marcell','Péter'],
        ['Nagy','Kovács','Tóth','Szabó','Horváth','Varga','Kiss','Molnár','Németh','Farkas','Balogh','Papp']],
  IND: [['Arjun','Rohan','Aditya','Karan','Siddharth','Vikram','Nikhil','Rahul','Aman','Dhruv','Yash','Ishaan'],
        ['Sharma','Patel','Reddy','Iyer','Singh','Gupta','Nair','Menon','Rao','Kumar','Desai','Chandra']],
  ITA: [['Lorenzo','Matteo','Andrea','Francesco','Alessandro','Leonardo','Riccardo','Gabriele','Tommaso','Federico','Simone','Davide'],
        ['Rossi','Russo','Ferrari','Esposito','Bianchi','Romano','Colombo','Ricci','Marino','Greco','Bruno','Gallo']],
  JPN: [['Haruto','Yuto','Sota','Ren','Kaito','Riku','Takumi','Shunsuke','Daiki','Kenta','Yuki','Sho'],
        ['Sato','Suzuki','Takahashi','Tanaka','Watanabe','Ito','Yamamoto','Nakamura','Kobayashi','Kato','Yoshida','Matsumoto']],
  KAZ: [['Nursultan','Arman','Yerlan','Daniyar','Aslan','Timur','Dmitriy','Alexey','Bekzat','Ruslan'],
        ['Abenov','Nurlanov','Seitkali','Zhumabekov','Ospanov','Kassymov','Popov','Kuznetsov','Akhmetov','Bekov']],
  KOR: [['Min-jun','Seo-jun','Ji-ho','Hyun-woo','Jae-won','Dong-hyun','Sung-min','Joon-young','Woo-jin','Tae-yang'],
        ['Kim','Lee','Park','Choi','Jung','Kang','Cho','Yoon','Jang','Lim','Han','Shin']],
  MAR: [['Youssef','Amine','Mehdi','Hamza','Anas','Ayoub','Reda','Othmane','Ilyas','Soufiane'],
        ['El Amrani','Benali','Alaoui','Bennani','Tazi','El Idrissi','Chraibi','Berrada','Ouazzani','Fassi']],
  MEX: [['Diego','Emiliano','Santiago','Rodrigo','Luis Ángel','Iván','Eduardo','Sebastián','Andrés','Ricardo'],
        ['Hernández','García','Martínez','López','González','Ramírez','Flores','Cruz','Reyes','Mendoza','Ortiz','Castillo']],
  NED: [['Daan','Sem','Thijs','Lars','Bram','Jesse','Ruben','Stijn','Niels','Tim'],
        ['de Jong','Jansen','de Vries','van den Berg','Bakker','Visser','Smit','Meijer','Mulder','de Boer','Bos','Vos']],
  NGA: [['Chinedu','Emeka','Tunde','Oluwaseun','Ibrahim','Abdullahi','Chukwuma','Segun','Ifeanyi','Babatunde'],
        ['Okafor','Adeyemi','Okonkwo','Balogun','Eze','Nwosu','Adebayo','Bello','Ogunleye','Usman','Obi','Akande']],
  NOR: [['Jakob','Emil','Sander','Henrik','Magnus','Kristian','Sindre','Tobias','Even','Mathias'],
        ['Hansen','Johansen','Olsen','Larsen','Andersen','Berg','Haugen','Bakken','Lie','Dahl','Solberg','Strand']],
  POL: [['Jakub','Kacper','Szymon','Mateusz','Michał','Bartosz','Piotr','Wojciech','Filip','Kamil'],
        ['Nowak','Kowalski','Wiśniewski','Wójcik','Kamiński','Lewandowski','Zieliński','Szymański','Woźniak','Dąbrowski','Mazur','Krawczyk']],
  POR: [['João','Tiago','Rodrigo','Duarte','Gonçalo','Francisco','Miguel','Diogo','Martim','Henrique'],
        ['Silva','Santos','Ferreira','Pereira','Oliveira','Costa','Rodrigues','Martins','Sousa','Gomes','Lopes','Marques']],
  RSA: [['Thabo','Sipho','Liam','Ruan','Kagiso','Pieter','Lwazi','Jason','Tshepo','Dylan'],
        ['Nkosi','van der Merwe','Botha','Dlamini','Pretorius','Mokoena','Naidoo','Ndlovu','du Plessis','Khumalo','Venter','Mahlangu']],
  SRB: [['Nikola','Stefan','Lazar','Miloš','Marko','Uroš','Nemanja','Dušan','Aleksa','Vuk'],
        ['Jovanović','Petrović','Nikolić','Marković','Đorđević','Stojanović','Ilić','Stanković','Pavlović','Milošević','Kostić','Lukić']],
  SUI: [['Luca','Noah','Jan','Nico','Elias','Rémy','Matteo','Dominic','Loïc','Yannick'],
        ['Müller','Meier','Schmid','Keller','Weber','Huber','Favre','Rochat','Bernasconi','Brunner','Baumann','Frei']],
  SWE: [['Erik','Oscar','William','Lucas','Hugo','Anton','Filip','Viktor','Isak','Gustav'],
        ['Andersson','Johansson','Karlsson','Nilsson','Eriksson','Larsson','Olsson','Persson','Svensson','Lindqvist','Berg','Holm']],
  TUN: [['Mohamed Ali','Aziz','Skander','Yassine','Firas','Wassim','Hamza','Mehdi','Oussama','Rayen','Malek','Anis'],
        ['Ben Salah','Trabelsi','Gharbi','Jebali','Haddad','Mejri','Ben Ammar','Bouazizi','Chaouachi','Hamdi','Ayari','Saidi']],
  TUR: [['Emre','Mert','Burak','Can','Kaan','Arda','Yusuf','Ege','Ozan','Berk','Efe','Alp'],
        ['Yılmaz','Kaya','Demir','Şahin','Çelik','Yıldız','Aydın','Öztürk','Arslan','Doğan','Kılıç','Koç']],
  USA: [['Tyler','Ryan','Brandon','Kyle','Austin','Ethan','Jake','Connor','Mason','Nate','Chris','Zach'],
        ['Johnson','Williams','Miller','Davis','Anderson','Thompson','Moore','Jackson','Clark','Lewis','Young','Allen']],
};

function randomName(nation, rng = Math.random) {
  const [firsts, lasts] = NAMES[nation];
  const first = firsts[Math.floor(rng() * firsts.length)];
  const last = lasts[Math.floor(rng() * lasts.length)];
  return FAMILY_FIRST.has(nation) ? `${last} ${first}` : `${first} ${last}`;
}
