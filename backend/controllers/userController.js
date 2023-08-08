const ErrorHandler = require('../utils/errorHandler');
const catchAsyncErrors = require('../middleware/catchAsyncErrors');
const User = require('../models/userModel');
const bcryptjs = require('bcryptjs');
const sendToken = require('../utils/jwtToken');
const sendEmail = require('../utils/sendEmail');
const crypto = require('crypto');
const cloudinary = require('cloudinary');

// Register a User
exports.registerUser = catchAsyncErrors( async (req,res,next) => {

    const myCloud = await cloudinary.v2.uploader.upload(req.body.avatar,{
        folder: "avatars",
        width: 150,
        crop: "scale"
    });

    const {name,email,password} = req.body;

    const user = await User.create({
        name,
        email,
        password,
        avatar:{
            public_id: myCloud.public_id,
            url: myCloud.secure_url
        }
    });

    sendToken(user,201,res);
});


// Login User
exports.loginUser = catchAsyncErrors( async (req,res,next) => {
    
    const {email,password} = req.body;

    if(!email || !password){
        return next(new ErrorHandler("Please Enter all the details",400));
    }

    const user = await User.findOne({email:email}).select('+password');

    if(!user){
        return next(new ErrorHandler("Invalid email or password",401));
    }

    const isPasswordMatched = await bcryptjs.compare(password,user.password);

    if(!isPasswordMatched){
        return next(new ErrorHandler("Invalid details",401));
    }

    sendToken(user,200,res);

})


// Logout User
exports.logout = catchAsyncErrors(async (req,res,next) => {
    
    res.cookie('token',null,{
        expires: new Date(Date.now()),
        httpOnly: true
    });

    res.status(200).json({
        success:true,
        message:"Logged Out"
    });

});


// Forgot Password
exports.forgotPassword = catchAsyncErrors(async (req,res,next) => {
    const user = await User.findOne({email:req.body.email});

    if(!user){
        return next(new ErrorHandler("User not found", 404));
    }

    // Get ResetPassword Token
    const resetToken = user.getResetPasswordToken();

    await user.save({validateBeforeSave:false});

    const resetPasswordUrl = `${process.env.FRONTEND_URL}/password/reset/${resetToken}`;

    const message = `Your password reset token is :- \n\n ${resetPasswordUrl} \n\n If you have not requested this email then please ignore it`;

    try{
        await sendEmail({
            email:user.email,
            subject:`Ecommerc Password Recovery`,
            message
        });
        res.status(200).json({
            success:true,
            message:`Email sent to ${user.email} successfully`
        });
    }catch(error){
        user.resetPasswordToken = undefined;
        user.resetPasswordExpire = undefined;
        await user.save({validateBeforeSave:false});
        return next(new ErrorHandler(error.message, 500));
    }
});



// Reset Password
exports.resetPassword = catchAsyncErrors(async (req,res,next) => {

    // creating token hash
    const resetPasswordToken = crypto.createHash("sha256").update(req.params.token).digest("hex");

    const user = await User.findOne({
        resetPasswordToken,
        resetPasswordExpire: {$gt: Date.now()},
    });

    if(!user){
        return next(new ErrorHandler("Reset Password Token is invalid or has been expired",400));
    }

    if(req.body.password !== req.body.confirmPassword){
        return next(new ErrorHandler("Password does not match",400));
    }

    user.password = req.body.password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;

    await user.save();

    sendToken(user,200,res);
})


// Get User Details
exports.getUserDetails = catchAsyncErrors(async (req,res,next) => {
    const user = await User.findById(req.user.id);
    res.status(200).json({
        success:true,
        user,
    });
});


// Update User Password
exports.updatePassword = catchAsyncErrors( async (req,res,next) => {

    const user = await User.findById(req.user.id).select("+password");

    const isPasswordMatched = await bcryptjs.compare(req.body.oldPassword,user.password);
    
    if(!isPasswordMatched){
        return next(new ErrorHandler("Old password is incorrect",400));
    }

    if(req.body.newPassword !== req.body.confirmPassword){
        return next(new ErrorHandler("password does not match",400));
    }

    user.password = req.body.newPassword;

    await user.save();

    sendToken(user, 200, res);
})


// Update User Profile
exports.updateProfile = catchAsyncErrors( async (req,res,next) => {

    const newUserData = {
        name:req.body.name,
        email:req.body.email
    }

    if(req.body.avatar !== ""){
        const user = await User.findById(req.user.id);
        const imageId = user.avatar.public_id;
        await cloudinary.v2.uploader.destroy(imageId);
        const myCloud = await cloudinary.v2.uploader.upload(req.body.avatar,{
            folder: 'avatars',
            width: 150,
            crop: 'scale'
        })

        newUserData.avatar = {
            public_id: myCloud.public_id,
            url: myCloud.secure_url
        }
    }

    const user = await User.findByIdAndUpdate(req.user.id,newUserData,{
        new:true,
        runValidators:true,
        useFindAndModify:false
    });

    res.status(200).json({
        success:true,
        message:"profile updated successfully"
    });
});


// Get all users --> Admin
exports.getAllUser = catchAsyncErrors(async (req,res,next) => {
    const users = await User.find();

    res.status(200).json({
        success:true,
        users,
    });
});


// Get single users --> Admin
exports.getSingleUser = catchAsyncErrors(async (req,res,next) => {
    const user = await User.findById(req.params.id);

    if(!user){
        return next(new ErrorHandler(`User does not exist with id : ${req.params.id}`));
    }

    res.status(200).json({
        success:true,
        user,
    });
});



// Update User Role -- Admin
exports.updateUserRole = catchAsyncErrors( async (req,res,next) => {

    const newUserData = {
        name:req.body.name,
        email:req.body.email,
        role:req.body.role
    }

    // we will add cloudinary later

    const user = await User.findByIdAndUpdate(req.params.id,newUserData,{
        new:true,
        runValidators:true,
        useFindAndModify:false
    });

    if(!user){
        return next(new ErrorHandler(`User don't exist  with Id : ${req.params.id}`,400));
    }

    res.status(200).json({
        success:true,
        message:"Role updated successfully"
    });
});



// Delete user -- Admin
exports.deleteUser = catchAsyncErrors( async (req,res,next) => {

    const user = await User.findById(req.params.id);

    // we will remove cloudinary later

    if(!user){
        return next(new ErrorHandler(`User does not exist with Id : ${req.params.id}`,400));
    }

    await user.deleteOne();

    res.status(200).json({
        success:true,
        message:"User deleted successfully"
    });
});