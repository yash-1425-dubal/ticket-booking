'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

interface Venue {
  id: string;
  name: string;
  address: string;
  city: string;
  totalRows: number;
  seatsPerRow: number;
  _count?: { movies: number };
}

const INDIAN_CITIES = [
  'mumbai', 'national-capital-region-ncr', 'bengaluru', 'hyderabad', 'chandigarh', 'ahmedabad', 'pune', 'chennai', 'kolkata', 'kochi', 'aalo', 'abohar', 'abu-road', 'achampet', 'acharapakkam', 'addanki', 'adilabad', 'adimali', 'adipur', 'adoni', 'agar-malwa', 'agartala', 'agiripalli', 'agra', 'ahilyanagar-ahmednagar', 'ahmedgarh', 'ahore', 'aizawl', 'ajmer', 'akaltara', 'akbarpur', 'akividu', 'akluj', 'akola', 'akot', 'alakode', 'alangudi', 'alangulam', 'alappuzha', 'alathur', 'alibaug', 'aligarh', 'alipurduar', 'allagadda', 'almora', 'alsisar-rajasthan', 'alur', 'alwar', 'amadalavalasa', 'amalapuram', 'amalner', 'amangal', 'amanpur', 'amaravathi', 'ambajipeta', 'ambajogai', 'ambala', 'ambalapuzha', 'ambikapur', 'ambur', 'amgaon', 'ampara', 'amravati', 'amreli', 'amritsar', 'amroha', 'anaikatti', 'anakapalle', 'anand', 'anandapur', 'anantapalli', 'anantapur', 'anaparthi', 'anchal', 'andaman-and-nicobar', 'anekal', 'angadipuram', 'angamaly', 'angara', 'angul', 'anjad', 'anjar', 'anklav', 'ankleshwar', 'ankola', 'annavaram', 'annigeri', 'anthiyur', 'anuradhapura', 'apra', 'arakkonam', 'arambagh', 'arambol', 'aranthangi', 'aravakurichi', 'ariyalur', 'arkalgud', 'armoor', 'arni', 'arsikere', 'aruppukottai', 'asansol', 'ashoknagar', 'ashoknagar-west-bengal', 'ashta', 'ashta-maharashtra', 'asika', 'aswaraopeta', 'atchampeta-ap', 'athagarh', 'athani', 'atmakur-kurnool', 'atmakur-nellore', 'atpadi', 'atraulia', 'attibele', 'attili', 'attingal', 'attur', 'aurangabad-bihar', 'aurangabad-west-bengal', 'auroville', 'aushapur', 'avinashi', 'ayodhya', 'azamgarh', 'b-kothakota', 'babra', 'badami', 'badaun', 'baddi', 'badhra', 'badnagar', 'badnawar', 'badulla', 'badvel', 'bagaha', 'bagalkot', 'bagbahara', 'bagepalli', 'bagha-purana', 'baghmari', 'bagnan', 'bagru', 'bahadurgarh', 'bahraich', 'baidyabati', 'baihar', 'baijnath', 'baikunthpur', 'baindur', 'bakhrahat', 'balaghat', 'balangir', 'balasore', 'balehonnur', 'balijipeta', 'ballia', 'balod', 'baloda-bazar', 'balotra', 'balrampur', 'balurghat', 'banaganapalli', 'banahatti', 'banaskantha', 'banda', 'banga', 'bangaon', 'bangarpet', 'bangarupalem', 'banki', 'bankura', 'banswada', 'banswara', 'bantumilli', 'bapatla', 'barabanki', 'baramati', 'baramulla', 'baran', 'barasat', 'baraut', 'barbil', 'bardoli', 'bareilly', 'bareja', 'bargarh', 'barharwa', 'barhi', 'baripada', 'barmer', 'barnala', 'barpeta', 'barpeta-road', 'barrackpore', 'barshi', 'baruipur', 'barwadih', 'barwaha', 'barwani', 'basantpur', 'basirhat', 'basmat', 'basna', 'basti', 'batala', 'bathinda', 'batlagundu', 'batticaloa', 'bavla', 'bayad', 'bayana', 'bazpur', 'beawar', 'beed', 'beguniapada', 'begusarai', 'behror', 'belagavi-belgaum', 'belakavadi', 'belghoria', 'bellampalli', 'bellary', 'belur', 'bemetara', 'bendamurulanka', 'berachampa', 'berhampore-wb', 'berhampur-odisha', 'bestavaripeta', 'betalbatim', 'betberia', 'bethamcherla', 'bettiah', 'betul', 'bhadrabaad', 'bhadrachalam', 'bhadrak', 'bhadravati', 'bhagalpur', 'bhagwanpur', 'bhainsa', 'bhandara', 'bhanjanagar', 'bhapel', 'bharamasagara', 'bharatpur', 'bharuch', 'bhatapara', 'bhatgaon', 'bhatkal', 'bhattiprolu', 'bhavani', 'bhavnagar', 'bhawani-mandi', 'bhawanipatna', 'bheemgal', 'bhilai', 'bhilwara', 'bhimadole', 'bhimavaram', 'bhind', 'bhiwadi', 'bhiwani', 'bhogapuram', 'bhojpur', 'bhongir', 'bhopal', 'bhubaneswar', 'bhuj', 'bhuntar', 'bhupalpalle', 'bhusawal', 'bhutan', 'bhuvanagiri', 'biaora', 'bibinagar', 'bichkunda', 'bidadi', 'bidar', 'bihar-sharif', 'bihpuria', 'bijainagar', 'bijnor', 'bijoynagar', 'bikaner', 'bikramganj', 'bilara', 'bilaspur', 'bilaspur-himachal-pradesh', 'bilgi', 'bilimora', 'billawar', 'biraul', 'birra', 'bishnupur', 'bishrampur', 'biswanath-chariali', 'bobbili', 'bodhan', 'bodinayakanur', 'boisar', 'bokakhat', 'bokaro', 'bolpur', 'bomdila', 'bommidi', 'bonakal', 'bongaigaon', 'bongaon', 'borsad', 'botad', 'brahmapur', 'brahmapuri', 'brajrajnagar', 'buchireddypalem', 'budaun', 'budhana', 'budhlada', 'buhari', 'bulandshahr', 'buldana', 'bundu', 'burdwan', 'burhanpur', 'burhar', 'buttayagudem', 'byadagi', 'byadgi', 'byasanagar', 'calicut', 'canning', 'chagallu', 'chakan', 'chalakudy', 'chalisgaon', 'challakere', 'challapalli', 'chamarajnagar', 'chamba', 'chamoli', 'champa', 'champahati', 'chanchal', 'chandannagar', 'chandausi', 'chandbali', 'chandpur-siau', 'chandrakona', 'chandrapur', 'chandur', 'changanassery', 'changaramkulam', 'channagiri', 'channapatna', 'channarayapatna', 'chanpatia', 'chapra', 'charkhi-dadri', 'chaygaon', 'chebrolu', 'cheeka', 'cheepurupalli', 'chelpur', 'chelur', 'chendrapinni', 'chengalpattu', 'chengannur', 'chennur', 'chenthrapini', 'cherial', 'cherla', 'cherpulassery', 'cherrapunji', 'cherthala', 'cherukupalli', 'cherupuzha', 'chetpet', 'chevella', 'cheyyar', 'cheyyur', 'chhabra', 'chhatarpur', 'chhatrapati-sambhajinagar-aurangabad', 'chhibramau', 'chhindwara', 'chickmagaluru', 'chidambaram', 'chikhli', 'chikkaballapur', 'chikkamagaluru', 'chikmagalur', 'chikodi', 'chilakaluripet', 'chinnalapatti', 'chinnamandem', 'chinnamanur', 'chinsurah', 'chintalapudi', 'chintamani', 'chinturu', 'chiplun', 'chiraiyakot', 'chirala', 'chirawa', 'chitradurga', 'chittoor', 'chittorgarh', 'chodavaram', 'chon-buri', 'chotila', 'choutuppal', 'churachandpur', 'churu', 'coimbatore', 'colombo', 'cooch-behar', 'coonoor', 'cuddalore', 'cumbum', 'cumbum-ap', 'cuttack', 'dabhara', 'dabra', 'dahanu', 'dahegam', 'dahod', 'dakshin-barasat', 'dalli-rajhara', 'dalmianagar', 'dalsinghsarai', 'daltonganj', 'daman', 'damarcherla', 'dammapeta', 'damoh', 'danapur', 'dandeli', 'dang', 'dankaur', 'dantewada', 'daporijo', 'darbhanga', 'darjeeling', 'darlapudi', 'darsi', 'darwha', 'dasuya', 'datia', 'daund', 'dausa', 'davanagere', 'davuluru', 'deesa', 'dehradun', 'dehri', 'deogadh', 'deoghar', 'deoli', 'deoli-rajasthan', 'deolirajasthan', 'deoria', 'deralakatte', 'devadurga', 'devakottai', 'devarakadra', 'devarakonda', 'devarapalle', 'devarapalli', 'devgad', 'dewas', 'dhamnod', 'dhampur', 'dhamtari', 'dhanaura', 'dhanbad', 'dhanera', 'dhar', 'dharamjaigarh', 'dharampur', 'dharamsala', 'dharamshala', 'dharapuram', 'dharashiv-osmanabad', 'dharmajigudem', 'dharmanagar', 'dharmapuri', 'dharmavaram', 'dharpally', 'dharpur', 'dharuhera', 'dharwad', 'dhaulana', 'dhekiajuli', 'dhemaji', 'dhenkanal', 'dholka', 'dholpur', 'dhone', 'dhoraji', 'dhrangadhra', 'dhubri', 'dhule', 'dhulian', 'dhuliyan', 'dhuri', 'diamond-harbour', 'dibrugarh', 'digras', 'dildar-nagar', 'dildarnagar', 'dima-hasao', 'dimapur', 'dinanagar', 'dindigul', 'diphu', 'dirang', 'doddaballapura', 'doimukh', 'domkal', 'dong', 'dongargarh', 'doolahat-bazar', 'doraha', 'dornakal', 'dowlaiswaram', 'draksharamam', 'dubbaka', 'dubrajpur', 'dudhi', 'duggirala', 'duliajan', 'dumka', 'dungarpur', 'durg', 'durgapur', 'dwarka', 'east-godavari', 'edappal', 'edlapadu', 'ekma', 'elesvaram', 'eluru', 'enkoor', 'eramalloor', 'erandol', 'erattupetta', 'ernakulam', 'erode', 'etah', 'etawah', 'ettumanoor', 'eturnagaram', 'faizabad', 'falakata', 'falna', 'faridkot', 'farrukhabad', 'fatehabad', 'fatehgarh-sahib', 'fatehpur', 'fatehpurrajasthan', 'fazilka', 'firozabad', 'firozpur', 'forbesganj', 'fulkusma', 'gmamidada', 'gadag', 'gadarwara', 'gadchiroli', 'gadhinglaj', 'gadivemula', 'gadwal', 'gajapathinagaram', 'gajendragarh', 'gajwel', 'galle', 'gampaha', 'gampalagudem', 'ganapavaram', 'gandhidham', 'gandhinagar', 'gangarampur', 'gangavati', 'gangoh', 'gangtok', 'ganjam', 'ganjbasoda', 'gannavaram', 'garhwa', 'garhwal', 'gariyadhar', 'garla', 'gauribidanur', 'gauriganj', 'gaya', 'gazole', 'georai', 'gharghoda', 'ghatanji', 'ghazipur', 'ghorasahan', 'ghumarwin', 'giddalur', 'gingee', 'giridih', 'goa', 'goalpara', 'gobichettipalayam', 'godavarikhani', 'godda', 'godhra', 'gogawa', 'gohana', 'gokak', 'gokarna', 'gokavaram', 'gola-bazar', 'gola-gokaran-nath', 'golaghat', 'gollaprolu', 'gonda', 'gondal', 'gondia', 'gonikoppal', 'goolikkadavu', 'gooty', 'gopalganj', 'gopalpet', 'gopiganj', 'gorakhpur', 'goramadagu', 'gorantla', 'gotegaon', 'gownipalli', 'gudivada', 'gudiyatham', 'gudlavalleru', 'gudur', 'guhagar', 'gulaothi', 'guledgudda', 'gummadidala', 'guna', 'gundlupet', 'guntakal', 'guntur', 'gurap', 'gurazala', 'gurdaspur', 'gurramkonda', 'guruvayur', 'guwahati', 'gwalior', 'habra', 'haflong', 'hagaribommanahalli', 'hajipur', 'haldia', 'halduchaur', 'haldwani', 'haliya', 'halol', 'hambantota', 'hamirpur-hp', 'hampi', 'handwara', 'hansi', 'hanuman-junction', 'hanumangarh', 'hapur', 'harda', 'hardoi', 'haria', 'haridwar', 'harihar', 'haripad', 'harugeri', 'harur', 'hasanparthy', 'hasanparthy', 'hasanpur', 'hasnabad', 'hassan', 'hathras', 'haveri', 'hazaribagh', 'himmatnagar', 'hindaun-city', 'hindupur', 'hindupuram', 'hinganghat', 'hingoli', 'hiramandalam', 'hirekerur', 'hiriyur', 'hisar', 'hojai', 'holenarasipura', 'honnali', 'honnavara', 'hooghly', 'hoshangabad', 'hoshiarpur', 'hoskote', 'hospet', 'hosur', 'howrah', 'hubballi-hubli', 'hunagunda', 'hunsur', 'husnabad', 'huvinahadagali', 'huzurabad', 'huzurnagar', 'ichalkaranji', 'ichchapuram', 'idappadi', 'idar', 'idukki', 'ieeja', 'imphal', 'indapur', 'indi', 'indore', 'indukurpeta', 'irinjalakuda', 'ishwarpur', 'itanagar', 'itarsi', 'jabalpur', 'jadcherla', 'jaffna', 'jafrabad', 'jagalur', 'jagatdal', 'jagatsinghpur', 'jagatsingpur', 'jagdalpur', 'jaggampeta', 'jaggayyapeta', 'jagraon', 'jagtial', 'jaijaipur', 'jaipur', 'jaisalmer', 'jajpur-road', 'jajpur-town-odisha', 'jalakandapuram', 'jalalabad', 'jalandhar', 'jalaun', 'jalgaon', 'jalna', 'jalore', 'jalpaiguri', 'jami', 'jamkhandi', 'jamkhed', 'jammalamadugu', 'jammikunta', 'jammu', 'jamnagar', 'jamner', 'jamshedpur', 'jamui', 'jangaon', 'jangareddy-gudem', 'janjgir', 'jannaram', 'jaora', 'jasdan', 'jashpur', 'jatni', 'jaunpur', 'jawalamukhi-jwalaji', 'jayamkondacholapuram', 'jaysingpur', 'jehanabad', 'jejuri', 'jetpur', 'jewar', 'jeypore', 'jhabua', 'jhajha', 'jhajjar', 'jhalawar', 'jhansi', 'jhargram', 'jharsuguda', 'jhunjhunu', 'jiaganj', 'jigani', 'jind', 'jintur', 'jirapur', 'joda', 'jodhpur', 'jolarpettai', 'jorhat', 'joynagar-majilpur', 'junagadh', 'junagarh', 'kd-peta', 'kadakkal', 'kadalundi', 'kadapa', 'kadi', 'kadiri', 'kadiyam', 'kadthal', 'kaij', 'kaikaluru', 'kaithal', 'kakarapalli', 'kakinada', 'kalaburagi-gulbarga', 'kalady', 'kalanaur', 'kalikiri', 'kalimpong', 'kalla', 'kallachi', 'kalladikode', 'kallakurichi', 'kallara', 'kallur', 'kalluru', 'kalna', 'kalol-gandhinagar', 'kalol-panchmahal', 'kalutara', 'kalwakurthy', 'kalyani', 'kamalaapur', 'kamalapur', 'kamalapuram', 'kamanaickenpalayam', 'kamareddy', 'kamavarapukota', 'kambainallur', 'kamptee', 'kamrej', 'kanakapura', 'kanatal', 'kanchikacherla', 'kanchipuram', 'kanchrapara', 'kandamangalam', 'kandukur', 'kandy', 'kangayam', 'kangra', 'kanhangad', 'kanichar', 'kanigiri', 'kanipakam', 'kanjirappally', 'kankavli', 'kanker', 'kankipadu', 'kankroli', 'kannauj', 'kanniyakumari', 'kannur', 'kanpur', 'kantabanji', 'kanyakumari', 'kapadvanj', 'kapurthala', 'karad', 'karaikal', 'karambakkudi', 'karanja-lad', 'karanjia', 'kareli', 'karepalli', 'kargi-road', 'karimangalam', 'karimganj', 'karimnagar', 'kariyad', 'karjat', 'karkala', 'karmala', 'karmamthody', 'karnal', 'karukachal', 'karunagapally', 'karur', 'karwar', 'kasaragod', 'kasdol', 'kasganj', 'kashig', 'kashipur', 'kashti', 'kasibugga', 'katghora', 'kathipudi', 'kathmandu', 'kathua', 'katihar', 'katni', 'katra', 'katrenikona', 'kattanam', 'kattappana', 'katwa', 'kavali', 'kavathe-mahankal', 'kaveripattinam', 'kaviti', 'kawardha', 'kayamkulam', 'kazhakkoottam', 'kazipet', 'kegalle', 'kekri', 'kendrapara', 'keonjhar', 'kesamudram', 'kesinga', 'kevadia', 'khachrod', 'khadda', 'khajani', 'khajipet', 'khajuraho', 'khajuri', 'khalilabad', 'khambhat', 'khamgaon', 'khammam', 'khanapur', 'khandela', 'khandwa', 'khanna', 'kharagpur', 'kharghar', 'khargone', 'khariar-road', 'kharsia', 'khategaon', 'khatima', 'khatta', 'khed', 'kheda', 'khedbrahma', 'khila', 'khopoli', 'khowai', 'khumulwng', 'khurja', 'kichha', 'kilimanoor', 'kilinochchi', 'kim', 'kinathukadavu', 'kinnaur', 'kirlampudi', 'kishanganj', 'kishangarh', 'kodad', 'kodagu-coorg', 'kodagu-siddapura', 'kodaikanal', 'kodakara', 'kodaly', 'koderma', 'kodumur', 'kodumuru', 'kodungallur', 'kohima', 'koilkuntla', 'kokrajhar', 'kolar', 'kolhapur', 'kollam', 'kollapur', 'kollengode', 'kolluru', 'komarapalayam', 'kommugudem', 'kondagaon', 'kondamallepally', 'kondlahalli', 'konithiwada', 'konni', 'koothattukulam', 'kopargaon', 'koppam', 'koraput', 'koratagere', 'korba', 'korukonda', 'korutla', 'korwa', 'kosamba', 'kosgi', 'kota', 'kota-ap', 'kotabommali', 'kotananduru', 'kotdwara', 'kothacheruvu', 'kothagudem', 'kothakota', 'kothamangalam', 'kothapalli', 'kothapeta', 'kothavalasa', 'kotkapura', 'kotma', 'kotpad', 'kotputli', 'kottakkal', 'kottayam', 'kottayi', 'kottiyam', 'kotturu', 'kovilpatti', 'kovur-nellore', 'kovvur', 'koyyalagudem', 'kozhikode', 'kozhinjampara', 'krishnadevipeta', 'krishnagiri', 'krishnanagar', 'krishnarajanagara', 'krishnarajpete-krpete', 'krosuru', 'kruthivennu', 'kuchaman-city', 'kuchipudi', 'kudus', 'kujang', 'kuju', 'kukshi', 'kulithalai', 'kullu', 'kumarakom', 'kumbakonam', 'kumily', 'kunda', 'kundapura', 'kunigal', 'kunkuri', 'kunnamkulam', 'kuppam', 'kuravilangad', 'kurnool', 'kurseong', 'kurud', 'kurukshetra', 'kurumaseri', 'kurundwad', 'kurunegala', 'kushalnagar', 'kushinagar', 'kusumgram', 'kutch', 'kuthuparamba', 'ladakh', 'lakhanpur', 'lakhimpur', 'lakhimpur-kheri', 'lakhisarai', 'lakkavaram', 'laksar', 'lakshmeshwara', 'lakshmikantapur', 'lalgudi', 'lalitpur', 'lansdowne', 'latur', 'lavasa', 'leeja', 'leh', 'likabali', 'lingasugur', 'lohardaga', 'lonand', 'lonar', 'lonavala', 'loni', 'lucknow', 'ludhiana', 'lunawada', 'luxettipet', 'munnar', 'macherla', 'machilipatnam', 'madalu', 'madanapalle', 'maddur', 'madhavaram', 'madhepura', 'madhira', 'madhubani', 'madikeri', 'madugula', 'madurai', 'magadi', 'mahabaleshwar', 'mahabubabad', 'mahad', 'mahalingpur', 'maharajganj', 'mahasamund', 'mahbubnagar', 'mahemdavad', 'maheshtala', 'maheshwar', 'maheshwaram', 'mahishadal', 'mahudha', 'mahuva', 'mainpuri', 'makrana', 'makthal', 'malappuram', 'malda', 'malebennur', 'malegaon', 'malerkotla', 'malikipuram', 'malkangiri', 'malkapur', 'mall', 'malout', 'malur', 'mamallapuram', 'manali', 'manamadurai', 'mananthavady', 'manapparai', 'manawar', 'mancherial', 'mandapeta', 'mandarmoni', 'mandasa', 'mandav', 'mandawa', 'mandi', 'mandi-dabwali', 'mandi-gobindgarh', 'mandla', 'mandsaur', 'mandvi', 'mandwa', 'mandya', 'manendragarh', 'mangalagiri', 'mangaldoi', 'mangaluru-mangalore', 'mangalwedha', 'mangar', 'manikonda-ap', 'manipal', 'manjeri', 'manmad', 'mannar', 'mannargudi', 'mannarkkad', 'mannur', 'mansa', 'manthani', 'manuguru', 'manvi', 'maraimalai-nagar', 'marayur', 'margao', 'margherita', 'markapur', 'marpalle', 'marripeda', 'marthandam', 'martur', 'maslandapur', 'matale', 'matara', 'math-chandipur', 'mathabhanga', 'mathura', 'mattannur', 'mau', 'mavelikkara', 'mawana', 'mayannur', 'mayiladuthurai', 'medak', 'medarametla', 'medchal', 'medininagar', 'meerut', 'mehkar', 'mehsana', 'melattur', 'melli', 'memari', 'metpally', 'mettuppalayam', 'mettur', 'mhow', 'midnapore', 'miraj', 'mirganj', 'miryalaguda', 'mirzapur', 'moga', 'mokama', 'molakalmuru', 'mominpet', 'moneragala', 'moodbidri', 'moradabad', 'moranhat', 'morbi', 'morena', 'morigaon', 'morinda', 'mothkur', 'motihari', 'moyna', 'mudalagi', 'muddebihal', 'mudhol', 'mudigere', 'mughalsarai', 'mukerian', 'mukkam', 'muktsar', 'mulbagal', 'mulkanoor', 'mullaitivu', 'mullanpur', 'mulleria', 'mulugu', 'mulugu-ghanpur', 'mummidivaram', 'mundakayam', 'mundargi', 'mundra', 'mungra-badshahpur', 'muniguda', 'muradnagar', 'murshidabad', 'murtizapur', 'musiri', 'mussoorie', 'muvattupuzha', 'muzaffarnagar', 'muzaffarpur', 'mydukur', 'mylavaram', 'mysuru-mysore', 'nabadwip', 'nabarangpur', 'nabha', 'nadaun', 'nadia', 'nadiad', 'nagamangala', 'nagaon', 'nagapattinam', 'nagaram', 'nagaram-ap', 'nagari', 'nagarkurnool', 'nagaur', 'nagayalanka', 'nagda', 'nagercoil', 'nagothane', 'nagpur', 'naharlagun', 'naidupeta', 'naihati', 'nainital', 'najafgarh', 'najibabad', 'nakhatrana', 'nakodar', 'nakrekal', 'nalbari', 'nalgonda', 'nallajerla', 'namakkal', 'namchi', 'namkhana', 'namsai', 'nandakumar', 'nanded', 'nandigama', 'nandikotkur', 'nandipet', 'nandurbar', 'nandyal', 'nanjanagudu', 'nanpara', 'narasannapeta', 'narasaraopeta', 'narayangaon', 'narayankhed', 'narayanpet', 'narayanpur', 'narayanpur-assam', 'narayanpur-ch', 'nargund', 'narnaul', 'narsampet', 'narsapur', 'narsapur-medak', 'narsinghpur', 'narsipatnam', 'narwana', 'nashik', 'natham', 'nathdwara', 'nautanwa', 'navsari', 'nawada', 'nawalgarh', 'nawanshahr', 'nawapara', 'nayagarh', 'nazira', 'nazirpur', 'nedumbassery', 'nedumkandam', 'neelapalli', 'neemrana', 'neemuch', 'nelakondapalli', 'nelamangala', 'nellimarla', 'nellimoodu', 'nellore', 'nemmara', 'nenmara', 'nepalgunj', 'ner-parsopant', 'neral', 'nereducharla', 'new-tehri', 'neyveli', 'nichlaul', 'nidadavolu', 'nilagiri', 'nilakottai', 'nilambur', 'nilanga', 'nilgiris', 'nimapara', 'nimbahera', 'nindra', 'nipani', 'niphad', 'nirjuli', 'nizamabad', 'nokha', 'nooranad', 'nurpur', 'nuwara-eliya', 'nuzvid', 'nyamathi', 'oachira', 'oddanchatram', 'ojhar', 'okha', 'olpad', 'ongole', 'ooty', 'orai', 'orchha', 'ottapalam', 'p-dharmavaram', 'pgannavaram', 'pachore', 'padampur', 'paddhari', 'padrauna', 'padubidri', 'pakala', 'pala', 'palakkad', 'palakollu', 'palakonda', 'palakurthy', 'palamaner', 'palampur', 'palani', 'palanpur', 'palapetty', 'palasa', 'palghar', 'pali', 'palia-kalan', 'palitana', 'palladam', 'pallickathodu', 'pallipalayam', 'palluruthy', 'palus', 'palwal', 'palwancha', 'pamarru', 'pamgarh', 'pamidi', 'pamuru', 'panachamoodu', 'panaji', 'panapakkam', 'panchgani', 'panchkula', 'pandalam', 'pandavapura', 'pandhana', 'pandharkawada', 'pandharpur', 'pandua', 'panipat', 'panna', 'panruti', 'pansemal', 'paonta-sahib', 'papanasam', 'pappanadu', 'paradeep', 'paralakhemundi', 'paramathi-velur', 'parappanangadi', 'paratwada', 'parbhani', 'parchur', 'parigi-telangana', 'parihar', 'parkal', 'parli', 'parvathipuram', 'parwanoo', 'pasara', 'pasighat', 'patan', 'patan-cg', 'patan-satara', 'pathalgaon', 'pathanamthitta', 'pathanapuram', 'pathankot', 'pathapatnam', 'pathsala', 'patiala', 'patna', 'patran', 'patratu', 'pattabiram', 'pattambi', 'pattukkottai', 'pavagada', 'payakaraopeta', 'payyanur', 'payyoli', 'pazhayannur', 'pebbair', 'pedana', 'pedanandipadu', 'pedapadu', 'peddapalli', 'peddapuram', 'pen', 'pendra', 'pennagaram', 'penuganchiprolu', 'penugonda', 'peralam', 'perambalur', 'peravoor', 'peringamala', 'peringottukurissi', 'perinthalmanna', 'periyapatna', 'pernambut', 'perumpuzha', 'perundurai', 'petlad', 'phagwara', 'phalodi', 'phaltan', 'pharenda', 'phulbani', 'piduguralla', 'pilani', 'pileru', 'pilibhit', 'pimpalner', 'pimpri', 'pinjore', 'pipariya', 'pipraich', 'piravom', 'pithampur', 'pithapuram', 'pithora', 'pithoragarh', 'pitlam', 'pochampally', 'podalakur', 'podili', 'polavaram', 'pollachi', 'polonnaruwa', 'ponda', 'pondicherry', 'ponduru', 'ponkunnam', 'ponnamaravathi', 'ponnani', 'ponneri', 'poovar', 'porbandar', 'port-blair', 'porumamilla', 'pratapgarh-rajasthan', 'pratapgarh-up', 'prayagraj-allahabad', 'proddatur', 'pudukkottai', 'pudunagaram', 'pulgaon', 'puliampatti', 'pulivendula', 'puliyangudi', 'pulluvila', 'pulpally', 'pulwama', 'punalur', 'punganur', 'puranpur', 'purba-medinipur', 'puri', 'purnea', 'purulia', 'pusad', 'pusapatirega', 'pushkar', 'puthenvelikara', 'puthenvelikkara', 'puthoor', 'puttalam', 'puttur-andhra-pradesh', 'puttur-karnataka', 'rabkavi-banhatti', 'radhamoni', 'raebareli', 'raghopur', 'raghunathganj', 'rahata', 'rahimatpur', 'rahuri', 'raibag', 'raichur', 'raigad', 'raiganj', 'raigarh', 'raikal', 'raikot', 'railway-koduru', 'raipur', 'raipuriya', 'raisinghnagar', 'raja-ka-bagh', 'rajakumari', 'rajam', 'rajamahendravaram-rajahmundry', 'rajapalayam', 'rajapur', 'rajarampalli', 'rajavommangi', 'rajgangpur', 'rajgurunagar', 'rajiana', 'rajkot', 'rajnandgaon', 'rajpipla', 'rajpur', 'rajpura', 'rajsamand', 'rajula', 'ramachandrapuram', 'ramanagara', 'ramanathapuram', 'ramayampet', 'ramdurg', 'rameswarpur', 'ramgarh', 'ramgarhwa', 'ramjibanpur', 'ramnagar', 'rampachodavaram', 'rampur', 'ramtek', 'ranaghat', 'ranastalam', 'ranastalam', 'ranchi', 'randheja', 'ranebennur', 'rangia', 'rani', 'raniganj', 'ranipet', 'ranni', 'rapur', 'rasipuram', 'rath', 'ratlam', 'ratnagiri', 'ratnagiri-odisha', 'ratnapura', 'raver', 'ravulapalem', 'raxaul', 'rayachoti', 'rayagada', 'rayakottai', 'rayavaram', 'razole', 'rentachintala', 'renukoot', 'repalle', 'revdanda', 'rewa', 'rewari', 'ribhoi', 'ringas', 'rishikesh', 'rishra', 'robertsganj', 'rohtak', 'ron', 'rongjeng', 'roorkee', 'rourkela', 'routhulapudi', 'rudauli', 'rudrapur', 'rupnagar', 'sabbavaram', 'sadasivpet', 'safidon', 'sagar', 'sagara', 'sagwara', 'saharanpur', 'saharsa', 'sahibganj', 'sahjanwa', 'sakleshpur', 'sakti', 'salem', 'saligrama', 'salihundam', 'salipur', 'salur', 'samalkota', 'samastipur', 'sambalpur', 'sambhal', 'sambhar', 'samsi', 'sanand', 'sanawad', 'sangamner', 'sangareddy', 'sangaria', 'sangli', 'sangola', 'sangrur', 'sankarankoil', 'sankarapuram', 'sankeshwar', 'sankri', 'santhebennur', 'sanwer', 'saoner', 'saraipali', 'sarangarh', 'sarangpur', 'sarapaka', 'sardarshahar', 'sardhana', 'sardulgarh', 'sarnath', 'sarni', 'sarsiwa', 'sasaram', 'satana', 'satara', 'sathankulam', 'sathupally', 'sathyamangalam', 'satmile', 'satna', 'sattenapalle', 'saundatti', 'sawai-madhopur', 'sawantwadi', 'sayan', 'secunderabad', 'seethanagaram', 'seethathodu', 'sehmalpur', 'sehore', 'selu', 'semiliguda', 'senapati', 'sendhwa', 'sendurai', 'sengottai', 'seoni', 'seoni-malwa', 'seppa', 'serampore', 'shadnagar', 'shahada', 'shahapur', 'shahdol', 'shahjahanpur', 'shahpur', 'shahpura', 'shajapur', 'shamgarh', 'shamli', 'shankarampet', 'shankarpally', 'shankarpur', 'shegaon', 'shela', 'sheopur', 'sheoraphuli', 'sheorinarayan', 'shikaripur', 'shikarpur', 'shikrapur', 'shillong', 'shimla', 'shindkheda', 'shirahatti', 'shiralakoppa', 'shirali', 'shirpur', 'shirur', 'shivamogga', 'shivpuri', 'shopian', 'shoranur', 'shrigonda', 'shrirampur', 'shujalpur', 'shuklaganj', 'siddapura', 'siddharthnagar', 'siddhpur', 'siddipet', 'sidhpura', 'sidlaghatta', 'sihor', 'sihora', 'sikandra', 'sikar', 'silchar', 'siliguri', 'silvassa', 'sindhanur', 'sindhudurg', 'singapore', 'singarayakonda', 'singrauli', 'sinnar', 'sira', 'sircilla', 'sirkali', 'sirmaur', 'sirohi', 'sirsa', 'sirsi', 'siruguppa', 'sitamarhi', 'sitapur', 'sivaganga', 'sivakasi', 'sivasagar', 'siwan', 'solan', 'solapur', 'solasiramani', 'solukhumbu', 'sompeta', 'sonari', 'sonepur', 'songadh', 'sonipat', 'sonkatch', 'soron', 'south-24-parganas', 'sri-ganganagar', 'sri-sathya-sai', 'srikakulam', 'srinagar', 'srirangapatna', 'srivaikuntam', 'srivilliputhur', 'station-ghanpur', 'sugauli', 'sujangarh', 'sukma', 'sulia', 'sullia', 'sultanabad', 'sultanpur', 'sulthan-bathery', 'sumerpur', 'sunam', 'sunam', 'sundar-nagar', 'sundargarh', 'sunguvarchatram', 'supaul', 'surajpur', 'surat', 'surathkal', 'surendranagar', 'suri', 'suriya', 'suryapet', 'tnarasapuram', 'tihu', 'tadepalligudem', 'tadikalapudi', 'tadipatri', 'tajpur', 'talcher', 'taliparamba', 'tallapudi', 'tallarevu', 'talwandi-bhai', 'tamluk', 'tanda', 'tandur', 'tangla', 'tangutur', 'tanuku', 'tarakeswar', 'tarapur', 'tarikere', 'tarkeshwar', 'tasgaon', 'tatipaka', 'tawang', 'tekkali', 'tembhurni', 'tenali', 'tenkasi', 'terdal', 'tezpur', 'tezu', 'thalassery', 'thalayolaparambu', 'thalikulam', 'thallada', 'thamarassery', 'thanipadi', 'thanjavur', 'tharad', 'theni', 'thimmapuram-addu-road', 'thirthahalli', 'thirubuvanai', 'thirukkattupalli', 'thirumalagiri', 'thirunageswaram', 'thiruthuraipoondi', 'thiruttani', 'thiruvalla', 'thiruvananthapuram-trivandrum', 'thiruvarur', 'thodupuzha', 'thoothukudi', 'thorrur', 'thottiyam', 'thriprayar', 'thrissur', 'thullur', 'thuraiyur', 'tihu', 'tilda-neora', 'tindivanam', 'tinsukia', 'tiptur', 'tiruchendur', 'tiruchengode', 'tiruchirappalli', 'tirukoilur', 'tirumakudalu-narasipura', 'tirunelveli', 'tirupati', 'tirupattur', 'tiruppur', 'tirupur', 'tirur', 'tiruvallur', 'tiruvannamalai', 'tiruvarur', 'tiruvuru', 'tirwaganj', 'titagarh', 'titlagarh', 'tittakudi', 'tohana', 'tonk', 'toopran', 'trichy', 'trincomalee', 'trivandrum', 'tumakuru-tumkur', 'tumsar', 'tuni', 'tura', 'turputallu', 'turuvekere', 'udaipur', 'udaynarayanpur', 'udgir', 'udhampur', 'udumalaipettai', 'udumalpet', 'udupi', 'ujhani', 'ujjain', 'ulikkal', 'uluberia', 'ulundurpet', 'umaria', 'umbergaon', 'umbraj', 'umerkote', 'umred', 'una', 'una-gujarat', 'undavalli', 'unnao', 'uppada', 'uthamapalayam', 'uthangarai', 'uthiramerur', 'uthukottai', 'utraula', 'uttar-dinajpur', 'uttara-kannada', 'uttarkashi', 'vadakara', 'vadakkencherry', 'vadalur', 'vadanappally', 'vadodara', 'vaduj', 'vaijapur', 'vaitheeswarankoil', 'valanchery', 'valaparla', 'valigonda', 'valluru', 'valsad', 'vaniyambadi', 'vapi', 'varadaiahpalem', 'varadiyam', 'varanasi', 'varkala', 'vasind', 'vatsavai', 'vavuniya', 'vazhapadi', 'vedasandur', 'veeraghattam', 'velangi', 'velanja', 'velanthavalam', 'vellakoil', 'vellampalli', 'vellore', 'velugodu', 'vempalli', 'vemulawada', 'vengurla', 'venkatapuram', 'veraval', 'vetapalem', 'vettaikaranpudur', 'vettavalam', 'vidisha', 'vijapur', 'vijayapura-bengaluru-rural', 'vijayapura-bijapur', 'vijayarai', 'vijayawada', 'vikarabad', 'vikasnagar', 'vikravandi', 'villupuram', 'vinjamur', 'vinukonda', 'viralimalai', 'virudhachalam', 'virudhunagar', 'visnagar', 'vissannapeta', 'vita', 'vithlapur', 'vizag-visakhapatnam', 'vizianagaram', 'vrindavan', 'vuyyuru', 'vyara', 'wadakkancherry', 'wai', 'waluj', 'wanaparthy', 'wani', 'warangal', 'wardha', 'wardhannapet', 'warora', 'washim', 'wayanad', 'wele', 'west-kameng', 'wyra', 'yadagirigutta', 'yamunanagar', 'yanam', 'yangon', 'yavatmal', 'yelagiri', 'yelburga', 'yeleswaram', 'yellamanchili', 'yellandu', 'yellareddy', 'yellareddypet', 'yemmiganur', 'yeola', 'yerragondapalem', 'yerraguntla', 'yewat', 'yuksom', 'zaheerabad', 'zarap', 'zira', 'ziro'
];
// Total: 2061 cities

export default function AdminVenuesPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && (!user || user.role !== 'ADMIN')) {
      router.replace('/login');
    }
  }, [user, authLoading, router]);

  const [venues, setVenues] = useState<Venue[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [editingVenue, setEditingVenue] = useState<Venue | null>(null);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ name: '', address: '', city: '', totalRows: 10, seatsPerRow: 12 });
  const [editForm, setEditForm] = useState({ name: '', address: '', city: '', totalRows: 10, seatsPerRow: 12 });

  useEffect(() => {
    loadVenues();
  }, []);

  const loadVenues = async () => {
    try {
      const res = await api.get<{ data: Venue[] }>('/venues');
      setVenues(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const createVenue = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await api.post('/venues', form);
      setShowForm(false);
      setForm({ name: '', address: '', city: '', totalRows: 10, seatsPerRow: 12 });
      loadVenues();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const openEditModal = (venue: Venue) => {
    setEditingVenue(venue);
    setEditForm({
      name: venue.name,
      address: venue.address,
      city: venue.city,
      totalRows: venue.totalRows,
      seatsPerRow: venue.seatsPerRow,
    });
    setShowEditForm(true);
  };

  const updateVenue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingVenue) return;
    setError('');
    try {
      await api.patch(`/venues/${editingVenue.id}`, editForm);
      setShowEditForm(false);
      setEditingVenue(null);
      setEditForm({ name: '', address: '', city: '', totalRows: 10, seatsPerRow: 12 });
      loadVenues();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const deleteVenue = async (id: string) => {
    if (!confirm('Delete this venue?')) return;
    setError('');
    try {
      await api.delete(`/venues/${id}`);
      loadVenues();
    } catch (err: any) {
      setError(err.message);
    }
  };

  if (authLoading) return <div className="max-w-5xl mx-auto px-4 py-8"><p>Loading...</p></div>;
  if (!user || user.role !== 'ADMIN') return null;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Venue Management</h1>
        <button onClick={() => setShowForm(true)} className="btn-primary">Add Venue</button>
      </div>

      {error && <p className="text-red-600 text-sm mb-4">{error}</p>}

      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-xl p-6 max-w-lg w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold mb-4">New Venue</h2>
            <form onSubmit={createVenue} className="space-y-3">
              <input placeholder="Venue name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input-field" required />
              <input placeholder="Address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className="input-field" required />
              <select value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} className="input-field" required>
                <option value="">Select city</option>
                {INDIAN_CITIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="text-xs text-gray-500">Rows</label>
                  <input type="number" min={1} max={100} value={form.totalRows} onChange={(e) => setForm({ ...form, totalRows: +e.target.value })} className="input-field" required />
                </div>
                <div className="flex-1">
                  <label className="text-xs text-gray-500">Seats per Row</label>
                  <input type="number" min={1} max={50} value={form.seatsPerRow} onChange={(e) => setForm({ ...form, seatsPerRow: +e.target.value })} className="input-field" required />
                </div>
              </div>
              <div className="flex gap-2">
                <button type="submit" className="btn-primary flex-1">Create</button>
                <button type="button" onClick={() => setShowForm(false)} className="btn-outline flex-1">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showEditForm && editingVenue && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => { setShowEditForm(false); setEditingVenue(null); }}>
          <div className="bg-white rounded-xl p-6 max-w-lg w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold mb-4">Edit Venue</h2>
            <form onSubmit={updateVenue} className="space-y-3">
              <input placeholder="Venue name" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} className="input-field" required />
              <input placeholder="Address" value={editForm.address} onChange={(e) => setEditForm({ ...editForm, address: e.target.value })} className="input-field" required />
              <select value={editForm.city} onChange={(e) => setEditForm({ ...editForm, city: e.target.value })} className="input-field" required>
                <option value="">Select city</option>
                {INDIAN_CITIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="text-xs text-gray-500">Rows</label>
                  <input type="number" min={1} max={100} value={editForm.totalRows} onChange={(e) => setEditForm({ ...editForm, totalRows: +e.target.value })} className="input-field" required />
                </div>
                <div className="flex-1">
                  <label className="text-xs text-gray-500">Seats per Row</label>
                  <input type="number" min={1} max={50} value={editForm.seatsPerRow} onChange={(e) => setEditForm({ ...editForm, seatsPerRow: +e.target.value })} className="input-field" required />
                </div>
              </div>
              <div className="flex gap-2">
                <button type="submit" className="btn-primary flex-1">Save Changes</button>
                <button type="button" onClick={() => { setShowEditForm(false); setEditingVenue(null); }} className="btn-outline flex-1">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {loading ? <p>Loading...</p> : venues.length === 0 ? (
        <p className="text-gray-500">No venues created yet.</p>
      ) : (
        <div className="grid gap-4">
          {venues.map((venue) => (
            <div key={venue.id} className="card flex items-center justify-between">
              <div>
                <h3 className="font-semibold">{venue.name}</h3>
                <p className="text-sm text-gray-600">{venue.address}, {venue.city}</p>
                <p className="text-xs text-gray-400">{venue.totalRows} rows &times; {venue.seatsPerRow} seats &middot; {venue._count?.movies || 0} movies</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => openEditModal(venue)} className="btn-outline text-sm">Edit</button>
                <button onClick={() => deleteVenue(venue.id)} className="btn-danger text-sm">Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

