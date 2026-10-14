/* Touchline data pack: English Championship & League One, Nigeria Premier Football League,
   nations, name pools and notable players at clubs outside the simulated leagues.
   Lower-league squads are generated (realistic names, ratings set by league level). */
(function () {
  const C = (id, name, city, stadium, cap, founded, rep, c1, c2) => ({ id, name, city, stadium, cap, founded, rep, c1, c2 });
  const UK = { ENG: 62, SCO: 6, WAL: 5, IRL: 7, NIR: 3, JAM: 2, FRA: 2, NED: 2, NGA: 2, GHA: 2, USA: 1, POR: 1, ESP: 1, DEN: 1, AUS: 1, CAN: 1, BEL: 1 };

  TL.DATA.leagues.push({ id: 'ENG2', name: 'Championship', country: 'ENG', tier: 2, gen: { mean: 66, sd: 4.5, nats: UK }, clubs: [
    C('BIR', 'Birmingham City', 'Birmingham', "St Andrew's", 29409, 1875, 64, '#0000FF', '#FFFFFF'),
    C('BLB', 'Blackburn Rovers', 'Blackburn', 'Ewood Park', 31367, 1875, 60, '#009EE0', '#FFFFFF'),
    C('BRC', 'Bristol City', 'Bristol', 'Ashton Gate', 27000, 1894, 61, '#E21B23', '#FFFFFF'),
    C('CHA', 'Charlton Athletic', 'London', 'The Valley', 27111, 1905, 57, '#D4021D', '#FFFFFF'),
    C('COV', 'Coventry City', 'Coventry', 'Coventry Building Society Arena', 32609, 1883, 63, '#87CEEB', '#FFFFFF'),
    C('DER', 'Derby County', 'Derby', 'Pride Park', 32956, 1884, 60, '#FFFFFF', '#000000'),
    C('HUL', 'Hull City', 'Hull', 'MKM Stadium', 25586, 1904, 59, '#F5A12D', '#000000'),
    C('IPS', 'Ipswich Town', 'Ipswich', 'Portman Road', 29673, 1878, 66, '#0044AA', '#FFFFFF'),
    C('LEI', 'Leicester City', 'Leicester', 'King Power Stadium', 32259, 1884, 68, '#003090', '#FDBE11'),
    C('MID', 'Middlesbrough', 'Middlesbrough', 'Riverside Stadium', 34742, 1876, 63, '#E11B22', '#FFFFFF'),
    C('MWL', 'Millwall', 'London', 'The Den', 20146, 1885, 59, '#001D5E', '#FFFFFF'),
    C('NOR', 'Norwich City', 'Norwich', 'Carrow Road', 27359, 1902, 61, '#FFF200', '#00A650'),
    C('OXF', 'Oxford United', 'Oxford', 'Kassam Stadium', 12500, 1893, 55, '#FFD700', '#000080'),
    C('PTM', 'Portsmouth', 'Portsmouth', 'Fratton Park', 20867, 1898, 58, '#001489', '#FFFFFF'),
    C('PNE', 'Preston North End', 'Preston', 'Deepdale', 23404, 1880, 58, '#FFFFFF', '#000080'),
    C('QPR', 'Queens Park Rangers', 'London', 'Loftus Road', 18439, 1882, 58, '#1D5BA4', '#FFFFFF'),
    C('SHU', 'Sheffield United', 'Sheffield', 'Bramall Lane', 32050, 1889, 64, '#EE2737', '#FFFFFF'),
    C('SHW', 'Sheffield Wednesday', 'Sheffield', 'Hillsborough', 39732, 1867, 57, '#0E00F7', '#FFFFFF'),
    C('SOU', 'Southampton', 'Southampton', "St Mary's Stadium", 32384, 1885, 66, '#D71920', '#FFFFFF'),
    C('STK', 'Stoke City', 'Stoke-on-Trent', 'bet365 Stadium', 30089, 1863, 59, '#E03A3E', '#FFFFFF'),
    C('SWA', 'Swansea City', 'Swansea', 'Swansea.com Stadium', 21088, 1912, 59, '#FFFFFF', '#000000'),
    C('WAT', 'Watford', 'Watford', 'Vicarage Road', 22200, 1881, 61, '#FBEE23', '#ED2127'),
    C('WBA', 'West Bromwich Albion', 'West Bromwich', 'The Hawthorns', 26688, 1878, 62, '#122F67', '#FFFFFF'),
    C('WRX', 'Wrexham', 'Wrexham', 'Racecourse Ground', 12600, 1864, 60, '#D71920', '#FFFFFF')
  ] });

  TL.DATA.leagues.push({ id: 'ENG3', name: 'League One', country: 'ENG', tier: 3, gen: { mean: 59.5, sd: 4.5, nats: Object.assign({}, UK, { ENG: 72 }) }, clubs: [
    C('WIM', 'AFC Wimbledon', 'London', 'Plough Lane', 9215, 2002, 48, '#0A2C6B', '#FFDD00'),
    C('BNS', 'Barnsley', 'Barnsley', 'Oakwell', 23287, 1887, 52, '#E30613', '#FFFFFF'),
    C('BPL', 'Blackpool', 'Blackpool', 'Bloomfield Road', 16616, 1887, 51, '#F68712', '#FFFFFF'),
    C('BWA', 'Bolton Wanderers', 'Bolton', 'Toughsheet Community Stadium', 28723, 1874, 54, '#FFFFFF', '#263C7E'),
    C('BRD', 'Bradford City', 'Bradford', 'Valley Parade', 25136, 1903, 50, '#7A2537', '#FFC72C'),
    C('BRT', 'Burton Albion', 'Burton upon Trent', 'Pirelli Stadium', 6912, 1950, 45, '#FFD200', '#000000'),
    C('CAR', 'Cardiff City', 'Cardiff', 'Cardiff City Stadium', 33280, 1899, 56, '#0070B5', '#FFFFFF'),
    C('DON', 'Doncaster Rovers', 'Doncaster', 'Eco-Power Stadium', 15231, 1879, 48, '#E30613', '#FFFFFF'),
    C('EXE', 'Exeter City', 'Exeter', 'St James Park', 8696, 1904, 46, '#E30613', '#FFFFFF'),
    C('HUD', 'Huddersfield Town', 'Huddersfield', "John Smith's Stadium", 24121, 1908, 54, '#0E63AD', '#FFFFFF'),
    C('LEY', 'Leyton Orient', 'London', 'Brisbane Road', 9271, 1881, 49, '#E30613', '#FFFFFF'),
    C('LIN', 'Lincoln City', 'Lincoln', 'Sincil Bank', 10669, 1884, 48, '#E30613', '#FFFFFF'),
    C('LUT', 'Luton Town', 'Luton', 'Kenilworth Road', 12000, 1885, 56, '#F78F1E', '#002D62'),
    C('MAN', 'Mansfield Town', 'Mansfield', 'Field Mill', 9186, 1897, 46, '#FDB913', '#0055A5'),
    C('NTH', 'Northampton Town', 'Northampton', 'Sixfields', 7798, 1897, 46, '#7A1F31', '#FFFFFF'),
    C('PET', 'Peterborough United', 'Peterborough', 'Weston Homes Stadium', 15314, 1934, 49, '#0055A5', '#FFFFFF'),
    C('PLY', 'Plymouth Argyle', 'Plymouth', 'Home Park', 17900, 1886, 53, '#01543E', '#FFFFFF'),
    C('PVA', 'Port Vale', 'Stoke-on-Trent', 'Vale Park', 15036, 1876, 46, '#FFFFFF', '#000000'),
    C('REA', 'Reading', 'Reading', 'Select Car Leasing Stadium', 24161, 1871, 52, '#004494', '#FFFFFF'),
    C('ROT', 'Rotherham United', 'Rotherham', 'New York Stadium', 12021, 1925, 49, '#E30613', '#FFFFFF'),
    C('STE', 'Stevenage', 'Stevenage', 'Lamex Stadium', 7800, 1976, 45, '#E30613', '#FFFFFF'),
    C('STO', 'Stockport County', 'Stockport', 'Edgeley Park', 10841, 1883, 50, '#1C3F94', '#FFFFFF'),
    C('WIG', 'Wigan Athletic', 'Wigan', 'Brick Community Stadium', 25138, 1932, 50, '#1D59AF', '#FFFFFF'),
    C('WYC', 'Wycombe Wanderers', 'High Wycombe', 'Adams Park', 10137, 1887, 47, '#87CEEB', '#002D62')
  ] });

  TL.DATA.leagues.push({ id: 'NGA1', name: 'NPFL', fullName: 'Nigeria Premier Football League', country: 'NGA', tier: 1, gen: { mean: 58.5, sd: 4.5, nats: { NGA: 94, GHA: 2, BEN: 1, CMR: 1, NIG: 1, TOG: 1 } }, clubs: [
    C('ENY', 'Enyimba', 'Aba', 'Enyimba International Stadium', 16000, 1976, 48, '#0A7D3B', '#FFFFFF'),
    C('RAN', 'Rangers International', 'Enugu', 'Nnamdi Azikiwe Stadium', 22000, 1970, 46, '#D21034', '#FFFFFF'),
    C('KPL', 'Kano Pillars', 'Kano', 'Sani Abacha Stadium', 16000, 1990, 44, '#1C3F94', '#FFD700'),
    C('SHS', 'Shooting Stars', 'Ibadan', 'Lekan Salami Stadium', 18000, 1950, 44, '#1E90FF', '#FFFFFF'),
    C('RVU', 'Rivers United', 'Port Harcourt', 'Adokiye Amiesimaka Stadium', 38000, 2016, 47, '#0B3D91', '#FFFFFF'),
    C('REM', 'Remo Stars', 'Ikenne', 'Remo Stars Stadium', 5000, 2004, 47, '#87CEEB', '#000080'),
    C('PLU', 'Plateau United', 'Jos', 'New Jos Stadium', 15000, 1975, 43, '#FFD700', '#000000'),
    C('KWU', 'Kwara United', 'Ilorin', 'Kwara State Stadium', 18000, 1997, 43, '#00A651', '#FFFFFF'),
    C('LOB', 'Lobi Stars', 'Makurdi', 'Aper Aku Stadium', 15000, 1981, 42, '#0057B8', '#FFFFFF'),
    C('NTO', 'Niger Tornadoes', 'Minna', 'Bako Kontagora Stadium', 5000, 1975, 42, '#E30613', '#FFFFFF'),
    C('ABW', 'Abia Warriors', 'Umuahia', 'Umuahia Township Stadium', 5000, 2003, 42, '#00843D', '#FFD700'),
    C('BYU', 'Bayelsa United', 'Yenagoa', 'Samson Siasia Stadium', 15000, 2008, 41, '#003DA5', '#FFFFFF'),
    C('BIN', 'Bendel Insurance', 'Benin City', 'Samuel Ogbemudia Stadium', 12000, 1966, 43, '#00A651', '#FFFFFF'),
    C('IKC', 'Ikorodu City', 'Lagos', 'Onikan Stadium', 10000, 2018, 41, '#111111', '#FFD700'),
    C('NAS', 'Nasarawa United', 'Lafia', 'Lafia City Stadium', 10000, 1978, 41, '#E30613', '#FFFFFF'),
    C('KAT', 'Katsina United', 'Katsina', 'Muhammadu Dikko Stadium', 35000, 1993, 41, '#00843D', '#FFFFFF'),
    C('EKW', 'El-Kanemi Warriors', 'Maiduguri', 'El-Kanemi Stadium', 10000, 1985, 40, '#8B0000', '#FFFFFF'),
    C('WKT', 'Wikki Tourists', 'Bauchi', 'Abubakar Tafawa Balewa Stadium', 11000, 1992, 40, '#00843D', '#FFD700'),
    C('KUN', 'Kun Khalifat', 'Owerri', 'Dan Anyiam Stadium', 10000, 2019, 39, '#4B0082', '#FFFFFF'),
    C('WAW', 'Warri Wolves', 'Warri', 'Warri Township Stadium', 20000, 1985, 40, '#003DA5', '#FFD700')
  ] });

  // League economics: TV money (£m/season), wage and price scales relative to the Premier League.
  TL.LEAGUE_ECON = {
    ENG1: { tv: 95, wage: 1, ticket: 1, sponsor: 1, value: 1, budget: 1 },
    ESP1: { tv: 50, wage: 0.62, ticket: 0.8, sponsor: 0.8, value: 1, budget: 0.7 },
    ITA1: { tv: 40, wage: 0.55, ticket: 0.7, sponsor: 0.7, value: 0.95, budget: 0.6 },
    GER1: { tv: 45, wage: 0.6, ticket: 0.6, sponsor: 0.8, value: 1, budget: 0.65 },
    FRA1: { tv: 22, wage: 0.45, ticket: 0.6, sponsor: 0.5, value: 0.9, budget: 0.45 },
    ENG2: { tv: 9, wage: 0.3, ticket: 0.6, sponsor: 0.2, value: 0.7, budget: 0.18 },
    ENG3: { tv: 2, wage: 0.12, ticket: 0.45, sponsor: 0.06, value: 0.5, budget: 0.06 },
    NGA1: { tv: 0.15, wage: 0.02, ticket: 0.04, sponsor: 0.02, value: 0.2, budget: 0.012 }
  };

  /* ---------- Nations: code|name|confederation|strength|kit colour|second colour|name pool ---------- */
  const NATIONS = `ENG|England|UEFA|85|#FFFFFF|#CE1124|ENG;FRA|France|UEFA|86|#002395|#FFFFFF|FRA;ESP|Spain|UEFA|86|#C60B1E|#FFC400|ESP;POR|Portugal|UEFA|84|#C8102E|#046A38|POR;NED|Netherlands|UEFA|82|#F36C21|#FFFFFF|NED;GER|Germany|UEFA|83|#FFFFFF|#000000|GER;BEL|Belgium|UEFA|81|#E30613|#000000|NED;ITA|Italy|UEFA|82|#0066CC|#FFFFFF|ITA;CRO|Croatia|UEFA|79|#FF0000|#FFFFFF|SLAV;SUI|Switzerland|UEFA|77|#FF0000|#FFFFFF|GER;DEN|Denmark|UEFA|77|#C8102E|#FFFFFF|NORDIC;NOR|Norway|UEFA|77|#BA0C2F|#00205B|NORDIC;AUT|Austria|UEFA|77|#ED2939|#FFFFFF|GER;TUR|Turkey|UEFA|77|#E30A17|#FFFFFF|TUR;UKR|Ukraine|UEFA|75|#FFD700|#0057B7|WSLAV;SWE|Sweden|UEFA|75|#FECC00|#006AA7|NORDIC;SRB|Serbia|UEFA|75|#C6363C|#0C4076|SLAV;POL|Poland|UEFA|75|#FFFFFF|#DC143C|WSLAV;CZE|Czechia|UEFA|74|#D7141A|#11457E|WSLAV;HUN|Hungary|UEFA|74|#CE2939|#477050|HUN;SCO|Scotland|UEFA|73|#0065BF|#FFFFFF|SCO;WAL|Wales|UEFA|72|#C8102E|#00B140|WAL;GRE|Greece|UEFA|73|#0D5EAF|#FFFFFF|GRE;SVK|Slovakia|UEFA|72|#0B4EA2|#FFFFFF|WSLAV;SVN|Slovenia|UEFA|71|#005DA4|#FFFFFF|SLAV;ROU|Romania|UEFA|72|#FCD116|#002B7F|ROU;IRL|Ireland|UEFA|71|#169B62|#FFFFFF|IRL;NIR|Northern Ireland|UEFA|68|#00A651|#FFFFFF|IRL;GEO|Georgia|UEFA|72|#FFFFFF|#E30613|CAUC;ALB|Albania|UEFA|70|#E41E20|#000000|ALB;BIH|Bosnia and Herzegovina|UEFA|70|#002395|#FECB00|SLAV;ISL|Iceland|UEFA|68|#02529C|#DC1E35|NORDIC;FIN|Finland|UEFA|67|#FFFFFF|#003580|NORDIC;MKD|North Macedonia|UEFA|66|#D20000|#FFE600|SLAV;MNE|Montenegro|UEFA|67|#C40308|#D4AF37|SLAV;ISR|Israel|UEFA|68|#FFFFFF|#0038B8|ISR;BUL|Bulgaria|UEFA|65|#FFFFFF|#00966E|SLAV;KOS|Kosovo|UEFA|67|#244AA5|#D0A650|ALB;BLR|Belarus|UEFA|62|#C8313E|#FFFFFF|WSLAV;LUX|Luxembourg|UEFA|62|#EF3340|#00A3E0|FRA;ARM|Armenia|UEFA|63|#D90012|#0033A0|CAUC;EST|Estonia|UEFA|60|#0072CE|#000000|BALT;LVA|Latvia|UEFA|58|#9E3039|#FFFFFF|BALT;LTU|Lithuania|UEFA|59|#FDB913|#006A44|BALT;CYP|Cyprus|UEFA|60|#FFFFFF|#D57800|GRE;FRO|Faroe Islands|UEFA|57|#FFFFFF|#0065BD|NORDIC;KAZ|Kazakhstan|UEFA|62|#00AFCA|#FEC50C|CAS;AZE|Azerbaijan|UEFA|60|#0092BC|#E4002B|TUR;MDA|Moldova|UEFA|57|#0046AE|#FFD200|ROU;AND|Andorra|UEFA|50|#10069F|#FEDF00|ESP;MLT|Malta|UEFA|52|#CF142B|#FFFFFF|ITA;SMR|San Marino|UEFA|40|#5EB6E4|#FFFFFF|ITA;GIB|Gibraltar|UEFA|45|#DA000C|#FFFFFF|ENG;LIE|Liechtenstein|UEFA|45|#002B7F|#CE1126|GER;RUS|Russia|UEFA|72|#FFFFFF|#D52B1E|WSLAV;`
    + `MAR|Morocco|CAF|80|#C1272D|#006233|ARAB;SEN|Senegal|CAF|78|#FFFFFF|#00853F|WAFR;NGA|Nigeria|CAF|76|#008751|#FFFFFF|NGA;CIV|Côte d'Ivoire|CAF|76|#F77F00|#009E60|WAFR;EGY|Egypt|CAF|75|#CE1126|#FFFFFF|ARAB;ALG|Algeria|CAF|75|#FFFFFF|#006233|ARAB;CMR|Cameroon|CAF|74|#007A5E|#CE1126|WAFR;TUN|Tunisia|CAF|72|#E70013|#FFFFFF|ARAB;MLI|Mali|CAF|73|#14B53A|#FCD116|WAFR;GHA|Ghana|CAF|72|#FFFFFF|#CE1126|GHA;RSA|South Africa|CAF|71|#FFB612|#007749|SAFR;BFA|Burkina Faso|CAF|70|#EF2B2D|#009E49|WAFR;COD|DR Congo|CAF|72|#007FFF|#CE1021|WAFR;CPV|Cape Verde|CAF|70|#003893|#FFFFFF|POR;GAB|Gabon|CAF|68|#FCD116|#009E60|WAFR;GUI|Guinea|CAF|69|#CE1126|#009460|WAFR;ANG|Angola|CAF|67|#CC092F|#000000|POR;ZAM|Zambia|CAF|67|#198A00|#EF7D00|EAFR;UGA|Uganda|CAF|66|#FCDC04|#000000|EAFR;BEN|Benin|CAF|66|#FCD116|#008751|WAFR;KEN|Kenya|CAF|63|#BB0000|#006600|EAFR;MOZ|Mozambique|CAF|62|#D21034|#000000|POR;ZIM|Zimbabwe|CAF|63|#FFD200|#006400|EAFR;TAN|Tanzania|CAF|62|#1EB53A|#00A3DD|EAFR;EQG|Equatorial Guinea|CAF|67|#E32118|#3E9A00|ESP;MTN|Mauritania|CAF|65|#00A95C|#FFD700|ARAB;GAM|Gambia|CAF|63|#CE1126|#0C1C8C|GHA;NAM|Namibia|CAF|61|#003580|#D21034|SAFR;SUD|Sudan|CAF|62|#D21034|#FFFFFF|ARAB;LBY|Libya|CAF|63|#E70013|#000000|ARAB;MAD|Madagascar|CAF|62|#FC3D32|#007E3A|WAFR;COM|Comoros|CAF|61|#3A75C4|#FFC61E|WAFR;SLE|Sierra Leone|CAF|61|#1EB53A|#0072C6|GHA;TOG|Togo|CAF|63|#FFCE00|#006A4E|WAFR;CGO|Congo|CAF|61|#009543|#DC241F|WAFR;RWA|Rwanda|CAF|60|#00A1DE|#FAD201|EAFR;ETH|Ethiopia|CAF|57|#078930|#FCDD09|EAFR;GNB|Guinea-Bissau|CAF|63|#CE1126|#FCD116|POR;NIG|Niger|CAF|61|#E05206|#0DB02B|WAFR;CTA|Central African Republic|CAF|58|#003082|#FFCE00|WAFR;LBR|Liberia|CAF|58|#BF0A30|#002868|GHA;MWI|Malawi|CAF|58|#CE1126|#000000|EAFR;BDI|Burundi|CAF|58|#CE1126|#1EB53A|EAFR;`
    + `JPN|Japan|AFC|77|#000555|#FFFFFF|JPN;KOR|South Korea|AFC|76|#CD2E3A|#0047A0|KOR;IRN|Iran|AFC|74|#FFFFFF|#DA0000|IRN;AUS|Australia|AFC|73|#FFCD00|#00843D|ENG;KSA|Saudi Arabia|AFC|70|#FFFFFF|#006C35|ARAB;UZB|Uzbekistan|AFC|70|#FFFFFF|#0099B5|CAS;QAT|Qatar|AFC|68|#8A1538|#FFFFFF|ARAB;IRQ|Iraq|AFC|68|#FFFFFF|#007A3D|ARAB;UAE|United Arab Emirates|AFC|67|#FFFFFF|#00732F|ARAB;JOR|Jordan|AFC|67|#FFFFFF|#CE1126|ARAB;OMA|Oman|AFC|65|#DB161B|#FFFFFF|ARAB;BHR|Bahrain|AFC|64|#CE1126|#FFFFFF|ARAB;CHN|China|AFC|63|#DE2910|#FFDE00|CHN;SYR|Syria|AFC|63|#CE1126|#FFFFFF|ARAB;PLE|Palestine|AFC|63|#FFFFFF|#007A3D|ARAB;IDN|Indonesia|AFC|62|#FF0000|#FFFFFF|SEA;VIE|Vietnam|AFC|61|#DA251D|#FFFF00|SEA;THA|Thailand|AFC|61|#2D2A4A|#A51931|SEA;KGZ|Kyrgyzstan|AFC|60|#E8112D|#FFEF00|CAS;TJK|Tajikistan|AFC|60|#CC0000|#006600|CAS;PRK|North Korea|AFC|60|#ED1C27|#024FA2|KOR;LIB|Lebanon|AFC|59|#ED1C24|#00A651|ARAB;MAS|Malaysia|AFC|58|#FFCC00|#010066|SEA;KUW|Kuwait|AFC|57|#007A3D|#FFFFFF|ARAB;IND|India|AFC|56|#0047AB|#FF9933|SEA;`
    + `ARG|Argentina|CONMEBOL|85|#75AADB|#FFFFFF|LATAM;BRA|Brazil|CONMEBOL|84|#FFDF00|#009C3B|BRA;URU|Uruguay|CONMEBOL|79|#5CBFEB|#FFFFFF|LATAM;COL|Colombia|CONMEBOL|79|#FCD116|#003893|LATAM;ECU|Ecuador|CONMEBOL|77|#FFDD00|#034EA2|LATAM;PAR|Paraguay|CONMEBOL|73|#D52B1E|#FFFFFF|LATAM;CHI|Chile|CONMEBOL|71|#D52B1E|#0039A6|LATAM;VEN|Venezuela|CONMEBOL|71|#8B0000|#FFFFFF|LATAM;PER|Peru|CONMEBOL|70|#FFFFFF|#D91023|LATAM;BOL|Bolivia|CONMEBOL|64|#007934|#FFFFFF|LATAM;`
    + `USA|United States|CONCACAF|76|#FFFFFF|#002868|ENG;MEX|Mexico|CONCACAF|75|#006847|#FFFFFF|LATAM;CAN|Canada|CONCACAF|75|#FF0000|#FFFFFF|ENG;PAN|Panama|CONCACAF|71|#DA121A|#FFFFFF|LATAM;CRC|Costa Rica|CONCACAF|69|#CE1126|#002B7F|LATAM;JAM|Jamaica|CONCACAF|68|#FED100|#009B3A|ENG;HON|Honduras|CONCACAF|66|#FFFFFF|#0073CF|LATAM;HAI|Haiti|CONCACAF|64|#00209F|#D21034|WAFR;CUW|Curaçao|CONCACAF|64|#002B7F|#F9E814|NED;SLV|El Salvador|CONCACAF|62|#0F47AF|#FFFFFF|LATAM;GUA|Guatemala|CONCACAF|62|#4997D0|#FFFFFF|LATAM;TRI|Trinidad and Tobago|CONCACAF|60|#CE1126|#000000|ENG;SUR|Suriname|CONCACAF|60|#377E3F|#B40A2D|NED;DOM|Dominican Republic|CONCACAF|58|#002D62|#CE1126|LATAM;NCA|Nicaragua|CONCACAF|56|#0067C6|#FFFFFF|LATAM;`
    + `NZL|New Zealand|OFC|66|#FFFFFF|#000000|ENG;FIJ|Fiji|OFC|52|#FFFFFF|#62B5E5|ENG;SOL|Solomon Islands|OFC|51|#0051BA|#FCD116|ENG;NCL|New Caledonia|OFC|49|#C8102E|#0035AD|FRA;TAH|Tahiti|OFC|48|#CE1126|#FFFFFF|FRA`;
  TL.NATIONS_DATA = NATIONS.split(';').map(r => { const [code, name, confed, rating, c1, c2, pool] = r.split('|'); return { code, name, confed, rating: +rating, c1, c2, pool }; });
  for (const n of TL.NATIONS_DATA) TL.NAT_NAMES[n.code] = n.name;
  TL.BANNED_NATIONS = ['RUS'];

  /* ---------- Name pools for generated players ---------- */
  const P = (f, l) => ({ f: f.split(','), l: l.split(',') });
  Object.assign(TL.NAMES, {
    SCO: P('Lewis,Scott,Kieran,Ross,Callum,Ryan,Jamie,Liam,Craig,Fraser', 'MacDonald,Campbell,Stewart,Robertson,Murray,Fraser,McKenzie,Henderson,McLean,Grant'),
    WAL: P('Dafydd,Rhys,Owen,Gareth,Aaron,Ethan,Joe,Tom,Iwan,Morgan', 'Jones,Davies,Evans,Roberts,Hughes,Lewis,Morgan,Price,Griffiths,Thomas'),
    ITA: P('Lorenzo,Matteo,Alessandro,Federico,Davide,Andrea,Riccardo,Simone,Giorgio,Luca', 'Rossi,Russo,Ferrari,Esposito,Bianchi,Romano,Colombo,Ricci,Marino,Greco'),
    POR: P('João,Rúben,Diogo,Tiago,Rafael,Gonçalo,Bruno,André,Nuno,Pedro', 'Silva,Santos,Ferreira,Pereira,Costa,Rodrigues,Martins,Sousa,Fernandes,Gomes'),
    LATAM: P('Santiago,Matías,Nicolás,Juan,Lucas,Facundo,Emiliano,Joaquín,Diego,Sebastián', 'González,Rodríguez,Fernández,López,Martínez,Gómez,Díaz,Pérez,Romero,Acosta'),
    ARAB: P('Mohamed,Youssef,Ahmed,Omar,Karim,Hamza,Ayoub,Ali,Mahmoud,Ilyas', 'El Amrani,Benali,Haddad,Mansour,Saleh,Nasser,Ibrahim,Hassan,Belkacem,Ziani'),
    WAFR: P('Moussa,Ibrahima,Cheikh,Mamadou,Amadou,Ismaël,Seydou,Boubacar,Yves,Serge', 'Diallo,Traoré,Koné,Coulibaly,Diop,Ndiaye,Camara,Sissoko,Touré,Bamba'),
    GHA: P('Kwame,Kofi,Kwabena,Yaw,Emmanuel,Daniel,Joseph,Isaac,Samuel,Prince', 'Mensah,Asante,Boateng,Owusu,Appiah,Osei,Ofori,Addo,Agyemang,Danso'),
    EAFR: P('Brian,Collins,Dennis,Eric,Kevin,Moses,Patrick,Joseph,Victor,Emmanuel', 'Odhiambo,Mwangi,Otieno,Kamau,Okello,Mugisha,Banda,Phiri,Moyo,Mwila'),
    SAFR: P('Thabo,Sipho,Teboho,Lyle,Themba,Percy,Bongani,Ronwen,Mihlali,Khuliso', 'Mokoena,Dlamini,Nkosi,Zungu,Mahlangu,Ndlovu,Williams,Maseko,Modiba,Sithole'),
    SLAV: P('Luka,Marko,Nikola,Stefan,Ivan,Filip,Dušan,Petar,Josip,Mateo', 'Jovanović,Petrović,Nikolić,Marković,Horvat,Kovačević,Babić,Popović,Perić,Ilić'),
    WSLAV: P('Jakub,Kamil,Tomáš,Lukáš,Mykola,Oleksandr,Bartosz,Patrik,Vladyslav,Ondřej', 'Nowak,Kowalski,Novák,Svoboda,Shevchenko,Kovalenko,Wiśniewski,Dvořák,Bondarenko,Horák'),
    NORDIC: P('Erik,Oliver,Magnus,Lucas,Emil,Jonas,Mathias,Andreas,Viktor,Isak', 'Hansen,Johansson,Nielsen,Larsen,Andersson,Olsen,Berg,Lindqvist,Pedersen,Karlsson'),
    HUN: P('Dániel,Bence,Ádám,Milán,Zsolt,Márton,Gergő,Roland', 'Nagy,Kovács,Tóth,Szabó,Horváth,Varga,Kiss,Molnár'),
    ROU: P('Andrei,Ionuț,Alexandru,Răzvan,Florin,Denis,Nicolae,Valentin', 'Popescu,Ionescu,Stan,Dumitru,Munteanu,Stoica,Marin,Dobre'),
    GRE: P('Giorgos,Kostas,Nikos,Dimitris,Christos,Vangelis,Tasos,Petros', 'Papadopoulos,Pappas,Georgiou,Nikolaou,Ioannidis,Karagounis,Vlachos,Samaras'),
    TUR: P('Emre,Arda,Kerem,Mert,Burak,Yusuf,Ozan,Kaan', 'Yılmaz,Kaya,Demir,Şahin,Çelik,Aydın,Öztürk,Arslan'),
    ALB: P('Arbër,Elseid,Klaus,Ardian,Ermir,Milot,Fatos,Lirim', 'Hoxha,Krasniqi,Berisha,Gashi,Shala,Kelmendi,Dushku,Bytyqi'),
    CAUC: P('Giorgi,Levan,Davit,Hovhannes,Rustam,Luka,Saba,Tigran', 'Beridze,Gelashvili,Hakobyan,Mammadov,Lobzhanidze,Sargsyan,Kiteishvili,Aliyev'),
    BALT: P('Kristjan,Artūras,Andris,Mārtiņš,Rauno,Edgaras,Kaspars,Mattias', 'Kask,Kazlauskas,Bērziņš,Petrauskas,Tamm,Ozols,Jankauskas,Saar'),
    JPN: P('Haruto,Yuto,Sota,Ren,Kaito,Daichi,Takumi,Kenta', 'Sato,Suzuki,Takahashi,Tanaka,Watanabe,Ito,Yamamoto,Nakamura'),
    KOR: P('Min-jun,Seo-jun,Ji-ho,Hyun-woo,Jun-young,Dong-hyun,Sang-ho,Jae-won', 'Kim,Lee,Park,Choi,Jung,Kang,Cho,Yoon'),
    CHN: P('Wei,Hao,Jun,Lei,Yang,Peng,Bin,Tao', 'Wang,Li,Zhang,Liu,Chen,Yang,Huang,Zhao'),
    IRN: P('Ali,Mehdi,Reza,Saeid,Milad,Sardar,Alireza,Ehsan', 'Karimi,Hosseini,Rezaei,Mohammadi,Ahmadi,Jafari,Ghoddos,Nourollahi'),
    CAS: P('Abbosbek,Eldor,Jaloliddin,Otabek,Azizbek,Timur,Khusniddin,Islam', 'Fayzullaev,Shomurodov,Masharipov,Urunov,Kadyrov,Nurmatov,Alikulov,Hamrobekov'),
    SEA: P('Duc,Chanathip,Supachok,Egy,Witan,Safawi,Quang,Pratama', 'Nguyen,Tran,Pham,Wongsa,Saputra,Rasid,Songkrasin,Hadi'),
    ISR: P('Itay,Omer,Dor,Eran,Shon,Liel,Manor,Gavriel', 'Cohen,Levi,Mizrahi,Peretz,Biton,Dahan,Zahavi,Abada')
  });
  TL.namePoolFor = nat => { const n = TL.NATIONS_DATA.find(x => x.code === nat); return TL.NAMES[nat] || (n && TL.NAMES[n.pool]) || TL.NAMES.ENG; };

  /* ---------- Notable players at clubs outside the simulated leagues (not available to sign) ---------- */
  TL.ABROAD = `Victor Osimhen|ST|26|NGA|86|Galatasaray;Wilfred Ndidi|DM|28|NGA|79|Beşiktaş;Stanley Nwabali|GK|28|NGA|74|Chippa United;Raphael Onyedika|CM|24|NGA|77|Club Brugge;Bright Osayi-Samuel|RB|27|NGA|75|Fenerbahçe;Zaidu Sanusi|LB|28|NGA|74|Porto;Semi Ajayi|CB|31|NGA|73|Hull City;Cyriel Dessers|ST|30|NGA|75|Panathinaikos;Kelechi Iheanacho|ST|28|NGA|74|Celtic;Bruno Onyemaechi|LB|26|NGA|73|Olympiacos;`
    + `Cristiano Ronaldo|ST|40|POR|82|Al Nassr;João Cancelo|RB|31|POR|82|Al Hilal;Rúben Neves|CM|28|POR|82|Al Hilal;João Félix|AM|25|POR|79|Al Nassr;Diogo Costa|GK|25|POR|85|Porto;António Silva|CB|21|POR|80|Benfica;Gonçalo Inácio|CB|24|POR|82|Sporting CP;Francisco Trincão|RW|25|POR|81|Sporting CP;Pedro Gonçalves|AM|27|POR|80|Sporting CP;`
    + `Lionel Messi|RW|38|ARG|86|Inter Miami;Nicolás Otamendi|CB|37|ARG|78|Benfica;Rodrigo De Paul|CM|31|ARG|81|Inter Miami;Leandro Paredes|DM|31|ARG|79|Boca Juniors;Ángel Di María|RW|37|ARG|76|Rosario Central;`
    + `Neymar|AM|33|BRA|80|Santos;Ederson|GK|32|BRA|84|Fenerbahçe;Fabinho|DM|31|BRA|79|Al Ittihad;Danilo|CB|34|BRA|76|Flamengo;`
    + `N'Golo Kanté|DM|34|FRA|80|Al Ittihad;Karim Benzema|ST|37|FRA|82|Al Ittihad;Theo Hernández|LB|28|FRA|82|Al Hilal;`
    + `Darwin Núñez|ST|26|URU|80|Al Hilal;Luis Suárez|ST|38|URU|76|Inter Miami;Sadio Mané|LW|33|SEN|79|Al Nassr;Kalidou Koulibaly|CB|34|SEN|79|Al Hilal;Édouard Mendy|GK|33|SEN|80|Al Ahli;Yassine Bounou|GK|34|MAR|82|Al Hilal;Marcelo Brozović|DM|32|CRO|79|Al Nassr;Aleksandar Mitrović|ST|30|SRB|79|Al Rayyan;Sergej Milinković-Savić|CM|30|SRB|81|Al Hilal;Riyad Mahrez|RW|34|ALG|81|Al Ahli;Yannick Carrasco|LW|32|BEL|77|Al Shabab;`
    + `Son Heung-min|LW|33|KOR|82|LAFC;Daizen Maeda|LW|28|JPN|79|Celtic;André Onana|GK|29|CMR|80|Trabzonspor;Edson Álvarez|DM|27|MEX|80|Fenerbahçe;Franck Kessié|CM|28|CIV|80|Al Ahli;Sébastien Haller|ST|31|CIV|76|Utrecht;Steven Bergwijn|LW|27|NED|77|Al Ittihad`;
})();
