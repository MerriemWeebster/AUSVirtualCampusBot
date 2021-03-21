const Discord = require('discord.js');
const client = new Discord.Client();
const fs = require('fs');
const nodemailer = require('nodemailer');
const smtpTransport = require('nodemailer-smtp-transport');

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

var studentData = null;
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
            var rawData = JSON.parse(data);
            var modified = false;
            for(var i = 0; i < rawData.length; i++)
            {
                for(var j = 0; j < rawData.length; j++)
                {
                    if(i != j && rawData[i].studentID.toLowerCase() == rawData[j].studentID.toLowerCase())
                    {
                        modified = true;
                        rawData.splice(j);
                        i--;
                        j--;
                    }
                }
            }
            
            studentData = rawData;

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

client.on('ready', () => {
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
        member.send("Welcome back to the AUS Virtual Campus!");
    }
    else
    {
        member.send("Welcome to the AUS Virtual Campus! You can verify yourself here by sending your AUS ID! Examples: `b000XXXXX` `g000XXXXX`.");
        var role = member.guild.roles.resolveID("822913697751760936");
        member.roles.add(role);
    }
});

client.on('message', msg => {
    if(msg.author.bot || studentData == null)
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
      
        if(msg.content.toLowerCase().indexOf("monke") > -1)
        {
            msg.reply("monke\nhttps://cms.qz.com/wp-content/uploads/2015/09/gettyimages-712-24_h8_optimized.gif?quality=75&strip=all&w=350&h=197&crop=1");
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
                                    msg.reply("You have been verified.");
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
                            msg.reply("Invalid student ID. Examples for a valid ID: `b000XXXXX` `g000XXXXX`.");
                        }
                    }
                    else
                    {
                        msg.reply("Invalid student ID. Examples for a valid ID: `b000XXXXX` `g000XXXXX`.");
                    }
                }
                else
                {
                    msg.reply("Invalid student ID. Examples for a valid ID: `b000XXXXX` `g000XXXXX`.");
                }
            }
            else
            {
                msg.reply("Invalid command format. Example for a valid command: `verify <your-student-id> <your-code>`.");
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
                                    msg.reply("A code has been sent to the email `" + studentID + "@aus.edu`, please reply here with the command `verify <your-student-id> <your-code>`");
                                else
                                    msg.reply("You can only receive an email once every 5 minutes.");
                            }
                            else
                            {
                                if(mailStatus)
                                    msg.reply("Your code has been sent to the email `" + studentID + "@aus.edu`, please reply here with the command `verify <your-student-id> <your-code>`");
                                else
                                    msg.reply("You can only receive an email once every 5 minutes.");
                            }
                        }
                    }
                    else
                    {
                        msg.reply("Invalid student ID. Examples for a valid ID: `b000XXXXX` `g000XXXXX`.");
                    }
                }
                else
                {
                    msg.reply("Invalid student ID. Examples for a valid ID: `b000XXXXX` `g000XXXXX`.");
                }
            }
            else
            {
                msg.reply("Invalid student ID. Examples for a valid ID: `b000XXXXX` `g000XXXXX`.");
            }
        }   
    }
});

client.login('ODIyNDM4NDY0MjcxOTQxNjQy.YFSRgg.uJucJgPtXxzjM5y6Wc_nDCZCGbA');