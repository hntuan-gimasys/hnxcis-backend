/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Router } from 'express';
import { generateJson, generateText } from '../lib/gemini.ts';
import { asyncHandler, HttpError } from '../middleware/errorHandler.ts';
import { requireAuth } from '../middleware/auth.ts';

export const geminiRouter = Router();

geminiRouter.use(requireAuth);

// FR-032: AI Tra cứu báo cáo bằng ngôn ngữ tự nhiên (NL2Query)
geminiRouter.post(
  '/nl2query',
  asyncHandler(async (req, res) => {
    const { prompt, contextData } = req.body ?? {};
    if (!prompt) {
      throw new HttpError(400, 'Prompt is required');
    }

    const systemInstruction = `
Bạn là Trợ lý AI Phân tích & Tra cứu Báo cáo Chứng khoán của Sở Giao dịch Chứng khoán Hà Nội (HNX-CIS).
Nhiệm vụ của bạn là nhận câu hỏi bằng ngôn ngữ tự nhiên từ Lãnh đạo hoặc Chuyên viên HNX, sau đó phân tích dữ liệu thị trường được cung cấp và trả về kết quả định dạng JSON.

Phải phản hồi theo đúng định dạng JSON có cấu trúc sau:
{
  "summary": "Tóm tắt ngắn gọn bằng tiếng Việt chuyên nghiệp",
  "data": [
    {"label": "...", "value": 123, "category": "..."}
  ],
  "chartType": "bar" | "line" | "pie" | "table",
  "anomalyWarning": "Cảnh báo biến động bất thường nếu có (hoặc null nếu bình thường)",
  "recommendedActions": ["Hành động 1", "Hành động 2"]
}

Không sử dụng markdown formatting xung quanh JSON nếu có thể, hoặc đảm bảo JSON hợp lệ.
`;

    const userPrompt = `
Dữ liệu thị trường hiện tại: ${JSON.stringify(contextData || {})}
Câu hỏi của người dùng: "${prompt}"
`;

    const result = await generateJson(systemInstruction, userPrompt);
    res.json({ success: true, result });
  }),
);

// FR-064: AI Quét & trích xuất dữ liệu BCTC (Data Scan)
geminiRouter.post(
  '/datascan',
  asyncHandler(async (req, res) => {
    const { documentText, declaredValues } = req.body ?? {};
    if (!documentText) {
      throw new HttpError(400, 'documentText is required');
    }

    const systemInstruction = `
Bạn là AI Trích xuất Báo cáo Tài chính của Sở HNX (HNX-CIS FR-064).
Nhiệm vụ: Trích xuất các chỉ tiêu tài chính chính (Tổng tài sản, Doanh thu, Lợi nhuận sau thuế, Vốn chủ sở hữu, Lỗ lũy kế) từ văn bản/dữ liệu BCTC, so sánh với số liệu doanh nghiệp đã khai báo, tính % chênh lệch và phát hiện nghi vấn.

Trả về định dạng JSON:
{
  "extractionType": "FINANCIAL_STATEMENT",
  "confidenceScore": 0.95,
  "items": [
    {
      "fieldCode": "net_profit",
      "fieldName": "Lợi nhuận sau thuế",
      "extractedValue": 2150000000000,
      "declaredValue": 2150000000000,
      "variancePct": 0,
      "sourceSnippet": "LNST TNDN Q2/2026: 2.150.000.000.000 VND",
      "isFlagged": false,
      "flagReason": null
    }
  ],
  "summary": "Tóm tắt kết quả quét & đối chiếu"
}
`;

    const result = await generateJson(
      systemInstruction,
      `Văn bản/Dữ liệu BCTC cần trích xuất: ${documentText}\nSố liệu DN đã khai: ${JSON.stringify(
        declaredValues || {},
      )}`,
    );
    res.json({ success: true, result });
  }),
);

// FR-065: AI Hỗ trợ dịch Việt - Anh
geminiRouter.post(
  '/translate',
  asyncHandler(async (req, res) => {
    const { textVi, glossary } = req.body ?? {};
    if (!textVi) {
      throw new HttpError(400, 'textVi is required');
    }

    const systemInstruction = `
Bạn là AI Chuyên gia Dịch thuật Tài chính Chứng khoán HNX (HNX-CIS FR-065).
Nhiệm vụ: Dịch văn bản công bố thông tin từ Tiếng Việt sang Tiếng Anh chuyên ngành tài chính - chứng khoán Việt Nam.
Bắt buộc tuân thủ Từ điển Thuật ngữ HNX (Glossary):
- Sở Giao dịch Chứng khoán Hà Nội -> Hanoi Stock Exchange (HNX)
- Công bố thông tin -> Information Disclosure
- Hủy niêm yết -> Delisting
- Người có liên quan -> Related Persons / Related Parties
- Báo cáo tài chính -> Financial Statement
- Ngày giao dịch không hưởng quyền -> Ex-date / Ex-rights date
${glossary ? `Từ điển bổ sung do người dùng cung cấp: ${JSON.stringify(glossary)}` : ''}

Trả về JSON:
{
  "translatedTextEn": "...",
  "usedGlossaryTerms": ["Sở Giao dịch Chứng khoán Hà Nội -> Hanoi Stock Exchange"],
  "notes": "Lưu ý nếu có"
}
`;

    const result = await generateJson(
      systemInstruction,
      `Nội dung Tiếng Việt cần dịch: "${textVi}"`,
    );
    res.json({ success: true, result });
  }),
);

// FR-063: Chatbot FAQ HNX
geminiRouter.post(
  '/chatbot',
  asyncHandler(async (req, res) => {
    const { message, chatHistory } = req.body ?? {};
    if (!message) {
      throw new HttpError(400, 'message is required');
    }

    const systemInstruction = `
Bạn là Chatbot HNX-CIS hỗ trợ quy định niêm yết, trái phiếu và công bố thông tin của Sở Giao dịch Chứng khoán Hà Nội (HNX).
Hãy trả lời lịch sự, chính xác theo Quy chế HNX, Luật Chứng khoán và Nghị định 155/2020/NĐ-CP.
Nếu là câu hỏi nghiệp vụ phức tạp ngoài phạm vi, gợi ý người dùng gửi yêu cầu giải trình hoặc liên hệ Phòng Quản lý Niêm yết HNX.
`;

    const reply = await generateText(
      systemInstruction,
      `Lịch sử: ${JSON.stringify(chatHistory || [])}\nCâu hỏi mới: "${message}"`,
    );
    res.json({ success: true, reply });
  }),
);
