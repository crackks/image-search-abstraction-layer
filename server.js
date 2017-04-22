var express=require('express');
var mongo=require('mongodb').MongoClient;
var GoogleImages=require('google-images');
var config=require('./config.js');
var client=new GoogleImages(config[0],config[1]);
var hash=require('crypto');
var app=express();
var urlMongo='mongodb://localhost:27017/Image_search_abstracion_layer';
var JsonImg=[];

app.set('views', __dirname + '/views');
app.engine('html', require('ejs').renderFile);

app.get('/',function(req,res){
    res.render('home.html');
});
app.get('/imagesearch/:search',function(req,res){
    var search=req.params.search;
    var number=Math.floor(req.query.offset);
    if (number==undefined){
        number=1;
    }
    var page=Math.floor((number-1)/10)+1;
    mongo.connect(urlMongo,function(err,db){
        if (err){
            res.render('connectionFail.html');
        }
        var image=db.collection('Image');
        var id=hash.createHash('sha1').update(search).digest('hex');
        image.find({_id:id}).toArray(function(err,img){
            if (err){
                res.render('connectionFail.html');
            }
            if (img[0]==undefined){
                var searchImg={_id:id,search:search, count:1,date:msToIso(new Date())};
                image.insert(searchImg,function(err,data){
                    if (err){
                        res.send('Sorry we are temporarily not available');
                    }
                    console.log("ok3");
                    client.search(search,{page:page}).then(function(images){
                        for (var i=0; i<number;i++){
                            JsonImg[i]={url:images[i].url,description:images[i].description, thumbnail:images[i].thumbnail.url,context: images[i].parentPage};
                        }
                    console.log("ok2");
                    res.json(JsonImg); 
                    db.close();
                    });    
                });
            }
            else{
                image.update({_id:id},{
                    $inc:{count :1},
                    $set:{date:msToIso(new Date())}
                });
                console.log("ok4");
                client.search(search,{page:page}).then(function(images){
                    for (var i=0; i<number;i++){
                        JsonImg[i]={url:images[i].url,description:images[i].description, thumbnail:images[i].thumbnail.url,context: images[i].parentPage};
                    }
                    console.log("ok1");
                    res.json(JsonImg); 
                    db.close();
                }); 
            }
        });
    });
});


app.get('/latest/imagesearch',function(req, res) {
    mongo.connect(urlMongo,function (err,db){
        if (err){
            res.render('connectionFail.html');
        }
        var image=db.collection('Image');
        image.find().toArray(function(err,dataImg){
            if (err){
                res.render('connectionFail.html');
            }
            res.json(ordered(dataImg)) ;   
        });
    });
});

app.listen(8080);

function msToIso(date){
    var months=['January','February', 'Mars', 'April', 'May', 'June', 'July', 'August', 'September','October', 'November', 'December'];
    var unixDate=date.getTime();
    var isoDate=months[date.getMonth()]+" "+date.getDate()+', '+date.getFullYear()+' at '+date.toTimeString().split(" ")[0];
    return {when:isoDate,unixe:unixDate};
}

function ordered (dataImg){
    var order=[[0,dataImg[0].date.unixe]];
    var jsonArray=[];
    for (var i=1;i<dataImg.length;i++){
        var count=0;
        for (var j=0;j<order.length;j++){
            if (dataImg[i].date.unixe>order[j][1]){
                order.splice(j,0,[i,dataImg[i].date.unixe]);
                console.log('j: '+j+' i: '+i);
                j=order.length;
            }
            else{count++;}
        }
        if (count==order.length){
            order[order.length]=[i,dataImg[i].date.unixe];
        }
    }
    var len=10;
    if (dataImg.length<10){
        len=dataImg.length;
    }
    for (var k=0; k<len;k++){
        jsonArray[k]={search:dataImg[order[k][0]].search, when: dataImg[order[k][0]].date.when};
    }
   return jsonArray;
}
