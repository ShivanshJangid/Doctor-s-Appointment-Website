const ErrorHandler = require('../utils/errorHandler');

module.exports = (err,req,res,next) => {
    err.statusCode = err.statusCode || 500;
    err.message = err.message || "Internal Server Error";


    // Wrong mongodb id error
    if(err.name === "CastError"){
        const message = `Resource not found. Invalid : ${err.path}`;
        err = new ErrorHandler(message,400);
    }


    // Mongoose dubplicate key error
    if(err.code === 11000){
        const message = `Duplicate ${Object.keys(err.keyValue)} Entered`;
        err = new ErrorHandler(message,400);
    }


    // Wrong JWT error
    if(err.code === "JsonWebTokenError"){
        const message = `Json Web Token is invalid , Try again `;
        err = new ErrorHandler(message,400);
    }


    // JWT EXPIRE error
    if(err.code === "TokenExpiredError"){
        const message = `Json Web Token is Expired, Try again `;
        err = new ErrorHandler(message,400);
    }

    res.status(err.statusCode).json({
        success:false,
        message:err.message
    });
}