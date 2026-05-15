import axios from "axios";

const runTest = async () => {
  try {
    const res = await axios.post(
      "https://ce.judge0.com/submissions?base64_encoded=false&wait=true",
      {
        source_code: `console.log("TEST OK")`,
        language_id: 63,
        stdin: "",
      }
    );

    console.log("OUTPUT:", res.data.stdout);
  } catch (err) {
    console.log("FAILED:", err.message);
  }
};


const run = async (label, delay = 0) => {
  setTimeout(async () => {
    const res = await axios.post(
      "https://ce.judge0.com/submissions?base64_encoded=false&wait=true",
      {
        source_code: `console.log("${label}")`,
        language_id: 63,
        stdin: "",
      }
    );

    console.log(label, "=>", res.data.stdout);
  }, delay);
};
const testTimeout = async () => {
  try {
    const res = await axios.post(
      "https://ce.judge0.com/submissions?base64_encoded=false&wait=true",
      {
        source_code: `
while(true){}
        `,
        language_id: 63,
        stdin: "",
      }
    );

    console.log(res.data);
  } catch (err) {
    console.log("ERROR:", err.message);
  }
};



runTest();

run("FIRST", 0);
run("SECOND", 100);
run("THIRD", 200);

testTimeout();

