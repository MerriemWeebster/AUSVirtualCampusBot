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
        if(emailLimit[i].studentID == studentData)
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

function verifyStudent(studentID, code, userID)
{
    for(var i = 0; i < studentData.length; i++)
    {
        const student = studentData[i];
        if(student.studentID == studentID)
        {
            if(code == student.code)
            {
                student.userID = userID;
                saveFile();
                client.guilds.fetch("821983751147356171").then((guild) => {
                    guild.members.fetch(userID).then((member) => {
                        var role = member.guild.roles.resolveID("822441807300001793");
                        member.roles.add(role);
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
            studentData = JSON.parse(data);
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
});

client.on('guildMemberAdd', (member) => {
    if(member.user.bot)
        return;

    if(isVerifiedUser(member.id))
    {
        var role = member.guild.roles.resolveID("822441807300001793");
        member.roles.add(role);
        member.send("Welcome back to the AUS Virtual Campus!");
    }
    else
        member.send("Welcome to the AUS Virtual Campus! You can verify yourself here by sending your AUS ID! Examples: `b000XXXXX` `g000XXXXX`.");
});

client.on('message', msg => {
    if(msg.author.bot || studentData == null)
        return;

    if(msg.channel.guild != null)
    {
        if (msg.content === 'aus/ping') 
        {
          msg.reply('pong');
        }
      
        if(msg.content.toLowerCase().indexOf("monke") > -1)
        {
            msg.reply("monke");
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
                            if(verifyStudent(studentID, code, msg.author.id))
                            {
                                msg.reply("You have been verified.");
                            }
                            else
                            {
                                msg.reply("Invalid code for `" + studentID + "`, please send the student ID once again without any commands to receive your code again. Examples: `b000XXXXX` `g000XXXXX`.");
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
                        var added = false;
                        var code = makeid(6);
                        for(var i = 0; i < studentData.length; i++)
                        {
                            if(studentData[i].studentID == studentID)
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