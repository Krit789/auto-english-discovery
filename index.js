import clipboardy from 'clipboardy';
import figlet from "figlet";
import PromptSync from "prompt-sync";
import EngDis from "./lib/engdis.lib.js";

const prompt = PromptSync({ sigint: true });
const baseUrlFe1 = "https://edwebservices2.engdis.com/api/";
const baseUrlFe2 = "https://eduiwebservices20.engdis.com/api/";
const baseUrlEFL = "https://edwebservices2.engdis.com/api/";
class Main {
  setting = {
    baseUrl: "",
    username: "",
    password: "",
  };
  engdis = new EngDis();

  constructor() {
    this.welcome();
  }

  async main() {
    await this.getInput();
    const loginToken = await this.login();
    if (!loginToken) process.exit();
    this.engdis = new EngDis(this.setting.baseUrl, loginToken.UserInfo.Token);
    let courses = await this.selectCourse();
    await this.setTaskSuccess(courses);

    const progress = await this.engdis.getProgress();
    console.log("Progress:", progress[0], "Grade:", progress[1])

    // await this.logout();
  }

  async welcome() {
    console.log(figlet.textSync("English Discoveries."));
    console.log(
      "[!] This bot only works with KMITL student!, last update at 03/10/24.\n==== Original groundwork by: @BossNz | Improved forked by: @Krit789 ====\n\n"
    );
  }

  async logout() {
    console.log("\n[*] Loging out...");
    await this.engdis.Logout();
    console.log("[#] Logout success, see you later.");
    // process.exit();
  }

  async getInput() {
    const endpoint = await prompt("[?] Choose your API endpoint ( fe1/fe2/efl/other ) : ").toLowerCase();
    if (endpoint == "fe1") {
      this.setting.baseUrl = baseUrlFe1;
    } else if (endpoint == "fe2") {
      this.setting.baseUrl = baseUrlFe2;
    } else if (endpoint == "efl") {
      this.setting.baseUrl = baseUrlEFL;
    } else {
      const baseUrl = await prompt("[?] Enter your custom endpoint : ");
      if (URL(baseUrl)) {
        this.setting.baseUrl = baseUrl;
      } else {
        console.log("[!] Invalid URL.");
      }
    }
    this.setting.username = await prompt("[?] enter your studentID  : ");
    // this.setting.baseUrl = baseUrlFe2
    // this.setting.username = "65050368"
    this.setting.password = this.setting.username.slice(-5);
    console.log();
  }

  async login() {
    const engdis = new EngDis(this.setting.baseUrl);
    console.log("[*] Waiting...");
    let result = await engdis.Login(
      this.setting.username,
      this.setting.password
    );
    if (!result.UserInfo) {
      console.log("[!] Username or Password is incorrect.");
    } else if (!result.UserInfo.Token) {
      console.log(
        "[!] Please logout from ed website before using this bot."
      );
    } else {
      console.log(`[#] Login success.\n`);
      return result;
    }
    return;
  }

  async selectCourse() {
    let courseProgressListTable = [];
    let courseTmp = [];
    const selectAllCourse = (await prompt("[?] Select all course (y/n) : ")) == "y" ? true : false;
    // const selectAllCourse = false

    console.log();
    var courseProgressList = await this.engdis.getGetDefaultCourseProgress();
    if (!courseProgressList.isSuccess) {
      console.log("[!] Token expired or invalid, please login again.");
      process.exit();
    }

    courseProgressList.data.map((item) => {
      if (selectAllCourse) {
        console.log(`[#] You choose course ( ${item.Name} )`);
        courseTmp.push({
          NodeId: item.NodeId,
          ParentNodeId: item.ParentNodeId,
        });
      } else {
        courseProgressListTable.push({
          Id: item.NodeId,
          Name: item.Name,
        });
      }
    });

    if (selectAllCourse) return courseTmp;

    console.table(courseProgressListTable);
    const selectId = await prompt("[?] Select unit id or index : ");
    // const selectId = 8;

    var find = courseProgressList.data.find(
      (ele, index) => ele.NodeId == selectId || index == selectId
    );

    if (!find) {
      console.log("[!] Can't find unit id or index", selectId);
      return [];
    }

    // console.log(`[#] you choose course ( ${find.Name} )`);
    courseTmp.push({
      NodeId: find.NodeId,
      ParentNodeId: find.ParentNodeId,
    });
    return courseTmp;
  }

  async setTaskSuccess(courses) {
    for (let course of courses) {
      var courseTree = await this.engdis.getCourseTree(
        course.NodeId,
        course.ParentNodeId
      );
      
      await courseTree.data.map(async (item) => {
        console.log(`\n[*] Completing Unit: ( ${item.Name} )`);

        await item.Children.map(async (elem) => {
          if (elem.Name != "Test") {
            console.log(`   [#]  Completing Chapter: ${elem.Name}`);

            elem.Children.map(async (ele) => {
              await this.engdis.setSucessTask(
                course.ParentNodeId,
                ele.NodeId
              );
            });
          } else {
            console.log(`   [#] Completing ${elem.Name}`)
            await this.setTest100Percent(item["Metadata"]["Code"], item["NodeId"], item["ParentNodeId"])
          }
        });
      });
    }
  }

  async setTest100Percent(code, nodeId, parentNodeId) {
    const testData = await this.engdis.getTestCodeDigit(code)
    var submitAnswer = [];

    for (var data of testData["tasks"]) {
      const id = data["id"]
      const code = data["code"]
      const type = data["type"]
      const testAnswerData = await this.engdis.practiceGetItem(code)

      if (testAnswerData["data"]["i"]["q"].length > 1) {
        for (var i = 1; i < testAnswerData["data"]["i"]["q"].length; i++) {
          testAnswerData["data"]["i"]["q"][0]["al"] = testAnswerData["data"]["i"]["q"][0]["al"].concat(testAnswerData["data"]["i"]["q"][i]["al"])
        }
      }

      const correctAnswerList = testAnswerData["data"]["i"]["q"][0]["al"]

      if (correctAnswerList.length == 0) continue
      const foundC = correctAnswerList[0]["a"].filter(item => item["c"] == "1")

      if (foundC.length != 0) {
        const answerUa = correctAnswerList.map(obj => [obj.id, obj.a.find(answer => answer.c === '1').id]);
        
        submitAnswer.push({
          "iId"	:	id,
          "iCode"	:	code,
          "iType"	: type,
          "ua": [
            {
                "qId": 1,
                "aId": answerUa
            }
          ]
        })
      } else {
        var uaList = [];

        for (const ans of correctAnswerList) {
          uaList.push(              {
            "qId": "1",
            "aId": [
                [
                    ans["id"],
                    ans["a"][0]["id"]
                ]
            ]
          })
        }

        submitAnswer.push({
          "iId": id,
          "iCode": code,
          "iType": type,
          "ua": uaList
        })
      }
    }

    const testStatus = await this.engdis.SaveUserTestV1(nodeId, parentNodeId, submitAnswer)
    console.log(testStatus["data"]["finalMark"])

    if (testStatus["data"]["finalMark"] != "100") {
      clipboardy.writeSync(JSON.stringify(submitAnswer))
      console.log(testStatus["data"]["finalMark"])
    }
  }
}

(async () => {
  const mainClass = new Main();
  mainClass.main();
})();
