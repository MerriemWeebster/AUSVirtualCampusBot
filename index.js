const Discord = require('discord.js');
const client = new Discord.Client();
const fs = require('fs');
const nodemailer = require('nodemailer');
const smtpTransport = require('nodemailer-smtp-transport');
const schedule = require('node-schedule');

var transporter = nodemailer.createTransport(smtpTransport({
    service: 'gmail',
    host: 'smtp.gmail.com',
    auth: {
      user: 'ausvirtualcampusbot@gmail.com',
      pass: 'ausvcbot@dani'
    },
    tls: {
        rejectUnauthorized: false
    }
}));

var gifs = null, gifsLonely = null;
const https = require('https');

function httpGetAsync(theUrl, callback)
{
    https.get(theUrl, (resp) => {
        let data = '';
      
        // A chunk of data has been recieved.
        resp.on('data', (chunk) => {
          data += chunk;
        });
      
        // The whole response has been received. Print out the result.
        resp.on('end', () => {
          callback(data);
        });
      
      }).on("error", (err) => {
        console.log("Error: " + err.message);
      });
}

// callback for the top 8 GIFs of search
function tenorCallback_search(responsetext)
{
    // parse the json response
    var response_objects = JSON.parse(responsetext);

    gifs = response_objects["results"];

    console.log("GIFs Loaded")
    return;
}

// function to call the trending and category endpoints
function grab_data(anon_id)
{
    // set the apikey and limit
    var apikey = process.env.TENOR_API;
    console.log("TENOR API - " + apikey)
    var lmt = 50;

    // test search term
    var search_term = "monke";

    // using default locale of en_US
    var search_url = "https://api.tenor.com/v1/search?contentfilter=medium&tag=" + search_term + "&key=" +
            apikey + "&limit=" + lmt + "&anon_id=" + anon_id;
            

    httpGetAsync(search_url,tenorCallback_search);

    // data will be loaded by each call's callback
    return;
}


// callback for anonymous id -- for first time users
function tenorCallback_anonid(responsetext)
{
    // parse the json response
    var response_objects = JSON.parse(responsetext);

    anon_id = response_objects["anon_id"];

    // pass on to grab_data
    grab_data(anon_id);
}

var url = "https://api.tenor.com/v1/anonid?key=" + process.env.TENOR_API;

var studentData = [];
var emailLimit = [];

function makeid(length) 
{
    var result = '';
    var characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    var charactersLength = characters.length;
    for ( var i = 0; i < length; i++ ) 
    {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }

    return result;
}

function sendEmail(studentID, code)
{
    for(var i = 0; i < emailLimit.length; i++)
    {
        const sentDate = new Date(emailLimit[i].date)
        if(sentDate.getTime() <= (new Date()).getTime())
        {
            emailLimit.splice(i);
            i--;
        }
    }

    var found = false, limited = false;

    for(var i = 0; i < emailLimit.length; i++)
    {
        if(emailLimit[i].studentID.toLowerCase()  == studentID.toLowerCase() )
        {
            found = true;
            const sentDate = new Date(emailLimit[i].date)
            if(sentDate.getTime() > (new Date()).getTime())
            {
                limited = true;
            }
        }
    }

    if(limited)
        return false;

    if(!found)
        emailLimit.push({studentID: studentID, date: (new Date((new Date()).getTime() + 300000)).toJSON()})

    console.log(emailLimit)

    var mailOptions = {
        from: 'ausvirtualcampusbot@gmail.com',
        to: studentID + '@aus.edu',
        subject: 'AUS Virtual Campus Verification Code',
        html: 'Here is your verification code: <b>' + code + '</b>\n\nReply to the bot with <b>verify ' + studentID + ' ' + code + '</b>'
    };
      
    transporter.sendMail(mailOptions, function(error, info){
        if (error) {
            console.log(error);
        } else {
            console.log('Email sent: ' + info.response);
        }
    });

    return true;
}

function isVerifiedUser(userID)
{
    for(var i = 0; i < studentData.length; i++)
    {
        const student = studentData[i];
        if(student.userID == userID)
        {
            return (student.userID != "");
        }
    }

    return false;
}

function isVerifiedStudent(studentID)
{
    for(var i = 0; i < studentData.length; i++)
    {
        const student = studentData[i];
        if(student.studentID.toLowerCase() == studentID.toLowerCase())
        {
            return (student.userID != "");
        }
    }

    return false;
}

function verifyStudent(studentID, code, userID)
{
    for(var i = 0; i < studentData.length; i++)
    {
        const student = studentData[i];
        if(student.studentID.toLowerCase()  == studentID.toLowerCase())
        {
            if(code == student.code)
            {
                student.userID = userID;
                saveFile();
                client.guilds.fetch("821983751147356171").then((guild) => {
                    guild.members.fetch(userID).then((member) => {
                        var role = member.guild.roles.resolveID("822441807300001793");
                        member.roles.add(role);
                        var unverifiedRole = member.guild.roles.resolveID("822913697751760936");
                        member.roles.remove(unverifiedRole);
                    }).catch((error) => console.log(error))
                }).catch((error) => console.log(error))
            }

            return (code == student.code);
        }
    }

    return false;
}

function readFile()
{
    fs.readFile('./users.json', 'utf8', (err, data) => 
    {
        if (err) 
        {
            console.log(`Error reading file from disk: ${err}`);
        } 
        else 
        {
            studentData = [];
            var rawData = JSON.parse(data);
            var modified = false;
            for(var i = 0; i < rawData.length; i++)
            {
                var add = true;

                for(var j = 0; j < studentData.length; j++)
                {
                    if(studentData[j].studentID.toLowerCase() == rawData[i].studentID.toLowerCase())
                    {
                        if(studentData[j].userID == "" && rawData[i].userID != "")
                            studentData[j].userID = rawData[i].userID;

                        modified = true;
                        add = false;
                    }
                }

                if(add)
                    studentData.push(rawData[i])
            }            

            if(modified)
                saveFile();
        }
    
    });
}

function saveFile()
{
    const data = JSON.stringify(studentData);
    
    fs.writeFile('./users.json', data, (err) => {
        if (err) throw err;
        console.log('Data written to file');
    });
}

function removeUnverified()
{
    client.guilds.fetch("821983751147356171").then((guild) => {
        guild.members.fetch().then((users) => {
            var members = users.array();
            console.log("Fetched " + members.length + " members to check unverified")
            for(var i = 0; i < members.length; i++)
            {
                if(!members[i].user.bot)
                {
                    var roles = members[i].roles.cache.array();

                    var checkToRemove = false;
    
                    for(var j = 0; j < roles.length; j++)
                    {
                        if(roles[j].id == "822913697751760936")
                            checkToRemove = true;
                    }
    
                    if(checkToRemove)
                    {
                        if((new Date()).getTime() - members[i].joinedAt.getTime() >= 86400000*7)
                        {
                            console.log("Kicked for inactivity: " + members[i].user.tag)
                            members[i].send("You have been removed from the server for not being verified after a week, please join again if you wish to be verified.").then(() => {
                                members[i].kick("Inactive and unverified");
                            }).catch((err) => {
                                console.log(err)
                                members[i].kick("Inactive and unverified");
                            })
                        }
                    }
                }
            }

            
        }).catch((error) => console.log(error))
    }).catch((error) => console.log(error))

    var startingDate = new Date();
    startingDate.setUTCHours(0,0,0,0);

    schedule.scheduleJob(new Date(startingDate.getTime() + 86400000), function(){
        removeUnverified();
    });
}


client.on('ready', () => {
    if(gifs == null)
        httpGetAsync(url,tenorCallback_anonid); 

    readFile();
    client.user.setActivity('AUS Students', { type: 'WATCHING' })
    .then(presence => console.log(`Activity set to ${presence.activities[0].name}`))
    .catch(console.error);

    client.guilds.fetch("821983751147356171").then((guild) => {
        guild.members.fetch().then((users) => {
            var members = users.array();
            console.log("Fetched " + members.length + " members")
            for(var i = 0; i < members.length; i++)
            {
                if(!members[i].user.bot)
                {
                    var roles = members[i].roles.cache.array();

                    var addRole = true;
    
                    for(var j = 0; j < roles.length; j++)
                    {
                        if(roles[j].id == "822441807300001793")
                            addRole = false;
                    }
    
                    if(addRole)
                    {
                        var role = members[i].guild.roles.resolveID("822913697751760936");
                        members[i].roles.add(role);
                    }
                }
            }

            removeUnverified();
        }).catch((error) => console.log(error))
    }).catch((error) => console.log(error))
});

client.on('guildMemberAdd', (member) => {
    if(member.user.bot)
        return;

    console.log("Welcomed " + member.displayName)

    if(isVerifiedUser(member.id))
    {
        var role = member.guild.roles.resolveID("822441807300001793");
        member.roles.add(role);
        member.send("Welcome back to the AUS Virtual Campus! Get your roles back in <#822446668288884776>.");
    }
    else
    {
        member.send("Welcome to the AUS Virtual Campus! You can verify yourself here by sending your AUS ID! Examples: `b000XXXXX` `g000XXXXX`.");
        var role = member.guild.roles.resolveID("822913697751760936");
        member.roles.add(role);
    }
});

client.on('message', msg => {
    if(msg.author.bot || studentData == [])
        return;

    if(msg.channel.guild != null)
    {
        if (msg.content.toLowerCase() === 'aus/ping') 
        {
            msg.reply(`🏓Latency is ${Date.now() - msg.createdTimestamp}ms. API Latency is ${Math.round(client.ws.ping)}ms`);
        }

        if(msg.content.toLowerCase().startsWith("aus/unverify ") && msg.author.id == "281876391535050762" && msg.mentions.users.array().length > 0)
        {
            var mentionedUsers = msg.mentions.users.array();
            var complete = false;
            for(var i = 0; i < studentData.length; i++)
            {
                if(studentData[i].userID == mentionedUsers[0].id)
                {
                    complete = true;
                    studentData[i].userID = "";
                    saveFile();
                    msg.reply("<@" + mentionedUsers[0].id + "> is now unverified");
                }
            }

            if(!complete)
                msg.reply("<@" + mentionedUsers[0].id + "> not found in database or already unverified");
        }

        if(msg.content.toLowerCase().startsWith("aus/readfile") && msg.author.id == "281876391535050762")
        {
            readFile();
            msg.reply("File read, data reset.")
        }
      
        if(msg.content.toLowerCase().indexOf("monke") > -1)
        {
            if(gifs == null)
            {
                httpGetAsync(url,tenorCallback_anonid); 
            }
            else
            {
                var randomGif = Math.floor(Math.random() * gifs.length)
                var gifURL = gifs[randomGif]["media"][0]["gif"]["url"]
                msg.reply("monke", {files: [gifURL]}).catch((err) => {
                    console.log(err)
                    gifs.splice(randomGif);
                    msg.reply("monke");
                });
            }
        }
    }
    else
    {
        if(isVerifiedUser(msg.author.id))
           return; 

        const params = msg.content.split(" ");

        if(params[0].toLowerCase() == "verify")
        {
            const studentID = params[1], code = params[2];

            if(studentID != undefined && code != undefined)
            {
                if(studentID.length == 9)
                {    
                    if((studentID.toLowerCase().indexOf("b000") > -1 || studentID.toLowerCase().indexOf("g000") > -1)
                    && (studentID.toLowerCase() != "b00000000" && studentID.toLowerCase() != "g00000000"))
                    {
                        console.log("Validating for verification: [" + studentID + "]")
                        var valid = true;
    
                        for(var i = 4; i < studentID.length; i++)
                        {
                            if(isNaN(studentID[i]))   
                                valid = false; 
                        }
    
                        if(valid)
                        {
                            if(isVerifiedStudent(studentID))
                            {
                                msg.reply("The student `" + studentID + "` has already been verified with another account.");
                            }
                            else
                            {
                                if(verifyStudent(studentID, code, msg.author.id))
                                {
                                    msg.reply("You have been verified. Give yourself some roles in <#822446668288884776> and introduce yourself in <#822027928043913246>! Maybe even add your birthday in <#823612251268972645>!");
                                    console.log("Verified " + msg.author.tag)
                                }
                                else
                                {
                                    msg.reply("Invalid code for `" + studentID + "`, please send the student ID once again without any commands to receive your code again. Examples: `b000XXXXX` `g000XXXXX`.");
                                }    
                            }
                        }
                        else
                        {
                            msg.reply("Invalid student ID, ID should have one letter and 8 numbers. Examples for a valid ID: `b000XXXXX` `g000XXXXX`.");
                        }
                    }
                    else
                    {
                        msg.reply("Invalid student ID, in correct format. Examples for a valid ID: `b000XXXXX` `g000XXXXX`.");
                    }
                }
                else
                {
                    msg.reply("Invalid student ID, incorrect length. Examples for a valid ID: `b000XXXXX` `g000XXXXX`.");
                }
            }
            else
            {
                msg.reply("Invalid command format. Example for a valid command: `verify your-student-id your-code`.");
            }
        }
        else
        {
            
            if(msg.content.length == 9)
            {
                const studentID = params[0];
    
                if((studentID.toLowerCase().indexOf("b000") > -1 || studentID.toLowerCase().indexOf("g000") > -1)
                && (studentID.toLowerCase() != "b00000000" && studentID.toLowerCase() != "g00000000"))
                {
                    var valid = true;

                    for(var i = 4; i < studentID.length; i++)
                    {
                        if(isNaN(studentID[i]))   
                            valid = false; 
                    }

                    if(valid)
                    {
                        if(isVerifiedStudent(studentID))
                        {
                            msg.reply("The student `" + studentID + "` has already been verified with another account.");
                        }
                        else
                        {
                            var added = false;
                            var code = makeid(6);
                            for(var i = 0; i < studentData.length; i++)
                            {
                                if(studentData[i].studentID.toLowerCase()  == studentID.toLowerCase() )
                                {
                                    added = true;
                                    code = studentData[i].code;
                                }
                            }

                            const mailStatus = sendEmail(studentID, code)
                            
                            if(!added)
                            {
                                studentData.push({studentID: studentID, userID: "", code: code});
                                saveFile();

                                if(mailStatus)
                                    msg.reply("A code has been sent to the email `" + studentID + "@aus.edu`, please reply here with the command `verify your-student-id your-code`");
                                else
                                    msg.reply("You can only receive an email once every 5 minutes.");
                            }
                            else
                            {
                                if(mailStatus)
                                    msg.reply("Your code has been sent to the email `" + studentID + "@aus.edu`, please reply here with the command `verify your-student-id your-code`");
                                else
                                    msg.reply("You can only receive an email once every 5 minutes.");
                            }
                        }
                    }
                    else
                    {
                        msg.reply("Invalid student ID, ID should have one letter and 8 numbers. Examples for a valid ID: `b000XXXXX` `g000XXXXX`.");
                    }
                }
                else
                {
                    msg.reply("Invalid student ID, in correct format. Examples for a valid ID: `b000XXXXX` `g000XXXXX`.");
                }
            }
            else
            {
                msg.reply("Invalid student ID, incorrect length. Examples for a valid ID: `b000XXXXX` `g000XXXXX`.");
            }
        }   
    }
});

client.login('ODIyNDM4NDY0MjcxOTQxNjQy.YFSRgg.uJucJgPtXxzjM5y6Wc_nDCZCGbA');