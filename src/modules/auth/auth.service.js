const autoBind = require("auto-bind");
const UserModel = require("../user/user.model");
const createHttpError = require("http-errors");
const { AuthMessage } = require("./auth.messages");
const { randomInt } = require("crypto");
const HttpStatus = require("http-codes");
const Kavenegar = require("kavenegar");
const jwt = require("jsonwebtoken");

require("dotenv").config();
const CODE_EXPIRES = 90 * 1000;

class AuthService {
  #model;
  constructor() {
    autoBind(this);
    this.#model = UserModel;
  }
  async sendOTP(mobile) {
    const user = await this.#model.findOne({ mobile });
    const now = new Date().getTime();
    const otp = {
      code: randomInt(10000, 99999),
      expiresIn: now + 1000 * 60 * 2,
    };

    if (!user) {
      const newUser = await this.#model.create({ mobile, otp });
      return newUser;
    }

    if (user.otp && user.otp.expiresIn > now) {
      throw new createHttpError.BadRequest(AuthMessage.OtpCodeNotExpired);
    }

    user.otp = otp;
    await user.save();

    // const kaveNegarApi = Kavenegar.KavenegarApi({
    //   apikey: `${process.env.KAVENEGAR_API_KEY}`,
    // });

    // kaveNegarApi.VerifyLookup(
    //   {
    //     receptor: mobile,
    //     token: otp,
    //     template: "registerVerify",
    //   },
    //   (response, status) => {
    //     console.log("kavenegar message status", status);
    //     if (response && status === 200)
    //       return res.status(HttpStatus.OK).send({
    //         statusCode: HttpStatus.OK,
    //         data: {
    //           message: `کد تائید برای شماره موبایل ${toPersianDigits(
    //             mobile
    //           )} ارسال گردید`,
    //           expiresIn: CODE_EXPIRES,
    //           mobile,
    //         },
    //       });

    //     return res.status(status).send({
    //       statusCode: status,
    //       message: "کد اعتبارسنجی ارسال نشد",
    //     });
    //   }
    // );
    return user;
  }
  async checkOTP(mobile, code) {
    const user = await this.checkExistByMobile(mobile);
    const now = new Date().getTime();

    if (user?.otp?.expiresIn < now)
      throw new createHttpError.Unauthorized(AuthMessage.OtpCodeExpired);

    if (user?.otp?.code !== code)
      throw new createHttpError.Unauthorized(AuthMessage.OtpCodeIsIncorrect);

    if (!user.verifiedMobile) {
      user.verifiedMobile = true;
    }

    const accessToken = this.signToken({ mobile, id: user._id });
    user.accessToken = accessToken;
    await user.save();
    return accessToken;
  }
  async checkExistByMobile(mobile) {
    const user = await this.#model.findOne({ mobile });
    if (!user) throw new createHttpError.NotFound(AuthMessage.NotFound);
    return user;
  }

  signToken(payload) {
    return jwt.sign(payload, process.env.JWT_SECRET_KEY, { expiresIn: "1y" });
  }
}
module.exports = new AuthService();
