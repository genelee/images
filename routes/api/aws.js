var crypto = require('crypto');
var moment = require('moment');

var awsApi = function(app, db) {
  console.log('included aws api');
  
  app.post('/api/aws/credentials', function(req, res, next) {
    // init variables
    var awsSecret = process.env.AWS_SECRET_ACCESS_KEY;
    var awsAccessKey = process.env.AWS_ACCESS_KEY_ID;
    var date = moment(Date.now()).format('YYYYMMDD');
    var datetz = moment(Date.now()).format('YYYYMMDD[T]HHMMSS[Z]');
    var region = "us-west-1";
    var credential = awsAccessKey + "%2F" + date + "%2F" + region + "%2F" + "s3%2Faws4_request";
    var payload = req.body.file;
    var policyJson = {
      "expiration": "2020-01-01T00:00:00Z",
      "conditions": [ 
        {"bucket": "genejaelee-assets"}, 
        ["starts-with", "$key", ""],
        {"acl": "public-read"},
        ["starts-with", "$Content-Type", ""],
        ["starts-with", "$filename", ""],
        {"x-amz-credential": credential },
        {"x-amz-algorithm": "AWS4-HMAC-SHA256"},
        {"x-amz-date": date}
      ]
    }
    // base64 encode policy JSON
    var encodedPolicy = Buffer(JSON.stringify(policyJson)).toString('base64');
    // hashed payload
    var hashedPayload = crypto.createHash('sha256').update(payload).digest('hex');
    console.log(hashedPayload);
    // create canonical request
    var canonicalRequest = "POST\n" +
                            "/\n" +
                            "\n" +
                            "host:genejaelee-assets.s3.amazonaws.com\n" +
                            "x-amz-date:" + datetz + "\n" +
                            "host;x-amz-date\n" +
                            hashedPayload;
    console.log('canonical request is ' + canonicalRequest);
    
    var hashedCanonicalRequest = crypto.createHash('sha256').update(canonicalRequest).digest('hex');
                            
    // create string to sign
    var stringToSign = "AWS4-HMAC-SHA256\n" +
                        datetz + "\n" +
                        credential + "\n" +
                        hashedCanonicalRequest;
    
    // run SHA256 hashing sequence to get signature
    var signature = generateHmac(awsSecret, date, region, "s3", stringToSign);
    
    // return parts as JSON
    res.json({
      'key': awsAccessKey,
      'policy': encodedPolicy,
      'signature': signature,
      'date': datetz,
      'credential': credential
    });
  });
}

function generateHmac (awsSecret, date, region, service, stringToSign, algorithm, encoding) {
  /*
  encoding = encoding || "base64";
  algorithm = algorithm || "sha256";
  var hash1 = crypto.createHmac(algorithm, "AWS4" + awsSecret).update(date).digest('binary');
  var hash2 = crypto.createHmac(algorithm, hash1).update(region).digest('binary');
  var hash3 = crypto.createHmac(algorithm, hash2).update(service).digest('binary');
  var hash4 = crypto.createHmac(algorithm, hash3).update("aws4_request").digest('binary');
  return crypto.createHmac(algorithm, hash4).update(stringToSign).digest('hex');
  */
  
  encoding = encoding || "base64";
  algorithm = algorithm || "sha256";
  var hash1 = crypto.createHmac(algorithm, "AWS4" + awsSecret);
  hash1.write(date);
  hash1.end();
  var hash2 = crypto.createHmac(algorithm, hash1.read());
  hash2.write(region);
  hash2.end();
  var hash3 = crypto.createHmac(algorithm, hash2.read());
  hash3.write(service);
  hash3.end();
  var hash4 = crypto.createHmac(algorithm, hash3.read());
  hash4.write( 'aws4_request' );
  hash4.end();
  var hash5 = crypto.createHmac(algorithm, hash4.read());
  hash5.write(stringToSign);
  hash5.end();
  var signature = hash5.read().toString('hex');
  console.log('signature is ' + signature);
  return signature;
}

module.exports = awsApi;