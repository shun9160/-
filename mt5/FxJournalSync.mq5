//+------------------------------------------------------------------+
//|                                              FxJournalSync.mq5   |
//|  MT5の取引履歴を FX Trading Journal へ自動送信する                 |
//|                                                                  |
//|  使い方は mt5/README.md を参照してください。                       |
//+------------------------------------------------------------------+
#property copyright "FX Trading Journal"
#property version   "1.00"

//--- 設定 ------------------------------------------------------------
input string  AppUrl           = "https://fx-daily.netlify.app"; // アプリのURL
input string  LinkCode         = "";      // 連携コード（アプリのアカウント画面で発行）
input int     DaysToSync       = 30;      // 何日前までを同期するか
input int     SyncEveryMinutes = 5;       // 定期同期の間隔(分)。0で定期同期しない
input bool    SyncOnTradeClose = true;    // 決済のたびに送信する
input bool    VerboseLog       = true;    // 詳細ログを出す

//--- 内部 ------------------------------------------------------------
#define BATCH_SIZE 100   // 1回のPOSTで送る最大件数

//+------------------------------------------------------------------+
int OnInit()
  {
   if(StringLen(LinkCode) < 8 || StringFind(AppUrl, "http") != 0)
     {
      Print("[FxJournal] 設定が未入力です。AppUrl と LinkCode を入れてください。");
      Print("[FxJournal] 連携コードは、アプリ右上のアカウント画面で発行できます。");
      return(INIT_FAILED);
     }

   if(SyncEveryMinutes > 0)
      EventSetTimer(SyncEveryMinutes * 60);

   Print("[FxJournal] 開始しました。起動時の同期を実行します。");
   SyncHistory();
   return(INIT_SUCCEEDED);
  }

//+------------------------------------------------------------------+
void OnDeinit(const int reason)
  {
   EventKillTimer();
   Print("[FxJournal] 停止しました。");
  }

//+------------------------------------------------------------------+
void OnTimer()
  {
   SyncHistory();
  }

//+------------------------------------------------------------------+
//| 決済が発生したら送信する                                          |
//+------------------------------------------------------------------+
void OnTradeTransaction(const MqlTradeTransaction &trans,
                        const MqlTradeRequest &request,
                        const MqlTradeResult &result)
  {
   if(!SyncOnTradeClose)
      return;
   if(trans.type != TRADE_TRANSACTION_DEAL_ADD)
      return;

   // 決済(OUT)のときだけ同期する
   if(HistoryDealSelect(trans.deal))
     {
      long entry = HistoryDealGetInteger(trans.deal, DEAL_ENTRY);
      if(entry == DEAL_ENTRY_OUT || entry == DEAL_ENTRY_OUT_BY || entry == DEAL_ENTRY_INOUT)
        {
         if(VerboseLog)
            Print("[FxJournal] 決済を検知したので同期します。");
         SyncHistory();
        }
     }
  }

//+------------------------------------------------------------------+
//| サーバー時刻 → UTC の補正値(秒)                                    |
//+------------------------------------------------------------------+
long ServerToUtcOffset()
  {
   // TimeCurrent() はサーバー時刻、TimeGMT() はUTC。差がサーバーのオフセット。
   return((long)TimeCurrent() - (long)TimeGMT());
  }

//+------------------------------------------------------------------+
//| datetime(サーバー時刻) を ISO8601(UTC) 文字列にする                |
//+------------------------------------------------------------------+
string ToIsoUtc(datetime serverTime, long offset)
  {
   datetime utc = (datetime)((long)serverTime - offset);
   MqlDateTime t;
   TimeToStruct(utc, t);
   return(StringFormat("%04d-%02d-%02dT%02d:%02d:%02dZ",
                       t.year, t.mon, t.day, t.hour, t.min, t.sec));
  }

//+------------------------------------------------------------------+
//| 数値をJSON用に。0や未設定は null にする                            |
//+------------------------------------------------------------------+
string JsonNum(double v, int digits, bool nullIfZero)
  {
   if(nullIfZero && MathAbs(v) < 1e-12)
      return("null");
   return(DoubleToString(v, digits));
  }

//+------------------------------------------------------------------+
//| 履歴を読み取って送信する                                          |
//+------------------------------------------------------------------+
void SyncHistory()
  {
   int      days = (DaysToSync < 1) ? 1 : DaysToSync;
   datetime from = (datetime)((long)TimeCurrent() - (long)days * 86400);
   if(!HistorySelect(from, TimeCurrent() + 3600))
     {
      Print("[FxJournal] 履歴を読み込めませんでした。");
      return;
     }

   long   offset   = ServerToUtcOffset();
   string currency = AccountInfoString(ACCOUNT_CURRENCY);

   // 決済済みポジションのIDを集める（重複を除く）
   long   posIds[];
   int    posCount = 0;
   int    deals    = HistoryDealsTotal();

   for(int i = 0; i < deals; i++)
     {
      ulong dealTicket = HistoryDealGetTicket(i);
      if(dealTicket == 0)
         continue;

      long entry = HistoryDealGetInteger(dealTicket, DEAL_ENTRY);
      if(entry != DEAL_ENTRY_OUT && entry != DEAL_ENTRY_OUT_BY && entry != DEAL_ENTRY_INOUT)
         continue;

      long posId = HistoryDealGetInteger(dealTicket, DEAL_POSITION_ID);
      if(posId == 0)
         continue;

      bool known = false;
      for(int k = 0; k < posCount; k++)
         if(posIds[k] == posId)
           {
            known = true;
            break;
           }
      if(known)
         continue;

      ArrayResize(posIds, posCount + 1);
      posIds[posCount] = posId;
      posCount++;
     }

   if(posCount == 0)
     {
      if(VerboseLog)
         Print("[FxJournal] 送る取引がありませんでした。");
      return;
     }

   // まとめてPOSTする
   string  batch    = "";
   int     inBatch  = 0;
   int     sentOk   = 0;
   int     sentNg   = 0;

   for(int p = 0; p < posCount; p++)
     {
      string row = BuildPositionJson(posIds[p], offset, currency);
      if(row == "")
         continue;

      if(inBatch > 0)
         batch += ",";
      batch += row;
      inBatch++;

      if(inBatch >= BATCH_SIZE)
        {
         if(PostTrades(WrapPayload(batch)))
            sentOk += inBatch;
         else
            sentNg += inBatch;
         batch   = "";
         inBatch = 0;
        }
     }

   if(inBatch > 0)
     {
      if(PostTrades(WrapPayload(batch)))
         sentOk += inBatch;
      else
         sentNg += inBatch;
     }

   PrintFormat("[FxJournal] 同期完了: 成功 %d件 / 失敗 %d件", sentOk, sentNg);
  }

//+------------------------------------------------------------------+
//| 1ポジションぶんのJSONを組み立てる                                 |
//+------------------------------------------------------------------+
string BuildPositionJson(long posId, long offset, string currency)
  {
   if(!HistorySelectByPosition(posId))
      return("");

   string   symbol      = "";
   string   side        = "";
   double   volume      = 0;
   double   openPrice   = 0;
   double   closePrice  = 0;
   datetime openTime    = 0;
   datetime closeTime   = 0;
   double   profit      = 0;
   double   swap        = 0;
   double   commission  = 0;
   double   sl          = 0;
   double   tp          = 0;
   long     closeReason = -1;
   ulong    openOrder   = 0;
   ulong    closeOrder  = 0;

   int deals = HistoryDealsTotal();
   for(int i = 0; i < deals; i++)
     {
      ulong d = HistoryDealGetTicket(i);
      if(d == 0)
         continue;
      if(HistoryDealGetInteger(d, DEAL_POSITION_ID) != posId)
         continue;

      // 手数料・スワップ・損益は全ディールの合計
      profit     += HistoryDealGetDouble(d, DEAL_PROFIT);
      swap       += HistoryDealGetDouble(d, DEAL_SWAP);
      commission += HistoryDealGetDouble(d, DEAL_COMMISSION);

      long entry = HistoryDealGetInteger(d, DEAL_ENTRY);
      if(entry == DEAL_ENTRY_IN)
        {
         symbol    = HistoryDealGetString(d, DEAL_SYMBOL);
         volume    = HistoryDealGetDouble(d, DEAL_VOLUME);
         openPrice = HistoryDealGetDouble(d, DEAL_PRICE);
         openTime  = (datetime)HistoryDealGetInteger(d, DEAL_TIME);
         openOrder = (ulong)HistoryDealGetInteger(d, DEAL_ORDER);
         side      = (HistoryDealGetInteger(d, DEAL_TYPE) == DEAL_TYPE_BUY) ? "buy" : "sell";
        }
      else
         if(entry == DEAL_ENTRY_OUT || entry == DEAL_ENTRY_OUT_BY || entry == DEAL_ENTRY_INOUT)
           {
            closePrice  = HistoryDealGetDouble(d, DEAL_PRICE);
            closeTime   = (datetime)HistoryDealGetInteger(d, DEAL_TIME);
            closeOrder  = (ulong)HistoryDealGetInteger(d, DEAL_ORDER);
            closeReason = HistoryDealGetInteger(d, DEAL_REASON);
            if(symbol == "")
               symbol = HistoryDealGetString(d, DEAL_SYMBOL);
           }
     }

   // 決済が終わっていないものは送らない
   if(closeTime == 0 || symbol == "" || side == "")
      return("");

   // S/L と T/P は建玉時の注文から取得する。
   // HistorySelectByPosition で注文もキャッシュ済みなので、
   // HistoryOrderSelect (キャッシュを作り直してしまう) は使わない。
   if(openOrder != 0)
     {
      sl = HistoryOrderGetDouble(openOrder, ORDER_SL);
      tp = HistoryOrderGetDouble(openOrder, ORDER_TP);
     }
   if(sl == 0 && tp == 0 && closeOrder != 0)
     {
      sl = HistoryOrderGetDouble(closeOrder, ORDER_SL);
      tp = HistoryOrderGetDouble(closeOrder, ORDER_TP);
     }

   // 途中で建値に動かした場合など、注文に残らないことがある。
   // 決済理由が S/L・T/P なら、決済価格がその水準そのもの。
   if(closeReason == DEAL_REASON_SL)
      sl = closePrice;
   if(closeReason == DEAL_REASON_TP)
      tp = closePrice;

   int digits = (int)SymbolInfoInteger(symbol, SYMBOL_DIGITS);
   if(digits <= 0)
      digits = 5;

   string json = "{";
   json += "\"ticket\":\""      + IntegerToString(posId) + "\",";
   json += "\"symbol\":\""      + symbol + "\",";
   json += "\"side\":\""        + side + "\",";
   json += "\"volume\":"        + DoubleToString(volume, 2) + ",";
   json += "\"open_price\":"    + DoubleToString(openPrice, digits) + ",";
   json += "\"close_price\":"   + DoubleToString(closePrice, digits) + ",";
   json += "\"sl\":"            + JsonNum(sl, digits, true) + ",";
   json += "\"tp\":"            + JsonNum(tp, digits, true) + ",";
   json += "\"open_time\":\""   + ToIsoUtc(openTime, offset) + "\",";
   json += "\"close_time\":\""  + ToIsoUtc(closeTime, offset) + "\",";
   json += "\"commission\":"    + DoubleToString(commission, 2) + ",";
   json += "\"swap\":"          + DoubleToString(swap, 2) + ",";
   json += "\"profit\":"        + DoubleToString(profit, 2) + ",";
   json += "\"currency\":\""    + currency + "\",";
   json += "\"source\":\"mt5\"";
   json += "}";
   return(json);
  }

//+------------------------------------------------------------------+
//| アプリへ送信する                                                  |
//|                                                                  |
//| 連携コードだけで本人が特定されるので、データベースの鍵は不要。      |
//| 取り込み済みの取引はアプリ側で無視される（メモや画像を守るため）。   |
//+------------------------------------------------------------------+
//+------------------------------------------------------------------+
//| 取引の配列に「どの口座か」を添えて、送信する本文を組み立てる       |
//| 口座番号を送ることで、サーバー側が口座を取り違えない               |
//+------------------------------------------------------------------+
string WrapPayload(string batch)
  {
   string body = "{";
   body += "\"account\":{";
   body += "\"login\":\""    + IntegerToString(AccountInfoInteger(ACCOUNT_LOGIN)) + "\",";
   body += "\"broker\":\""   + JsonEscape(AccountInfoString(ACCOUNT_COMPANY)) + "\",";
   body += "\"server\":\""   + JsonEscape(AccountInfoString(ACCOUNT_SERVER)) + "\",";
   body += "\"currency\":\"" + AccountInfoString(ACCOUNT_CURRENCY) + "\"";
   body += "},";
   body += "\"trades\":[" + batch + "]";
   body += "}";
   return(body);
  }

//+------------------------------------------------------------------+
//| JSON に入れられない文字を逃がす                                    |
//+------------------------------------------------------------------+
string JsonEscape(string v)
  {
   string out = v;
   StringReplace(out, "\\", "\\\\");
   StringReplace(out, "\"", "\\\"");
   return(out);
  }

bool PostTrades(string jsonArray)
  {
   string url = AppUrl;
   if(StringSubstr(url, StringLen(url) - 1, 1) == "/")
      url = StringSubstr(url, 0, StringLen(url) - 1);
   url += "/api/ingest";

   string headers = "";
   headers += "Authorization: Bearer " + LinkCode + "\r\n";
   headers += "Content-Type: application/json\r\n";

   char post[];
   int  len = StringToCharArray(jsonArray, post, 0, WHOLE_ARRAY, CP_UTF8);
   if(len > 0)
      ArrayResize(post, len - 1);   // 末尾のNUL文字は送らない

   char   result[];
   string resultHeaders = "";
   ResetLastError();

   int status = WebRequest("POST", url, headers, 10000, post, result, resultHeaders);

   if(status == -1)
     {
      int err = GetLastError();
      if(err == 4014)
         Print("[FxJournal] 送信できません。MT5の [ツール]→[オプション]→[エキスパートアドバイザ] で "
               + AppUrl + " を許可URLに追加してください。");
      else
         PrintFormat("[FxJournal] 送信エラー (コード %d)", err);
      return(false);
     }

   if(status >= 200 && status < 300)
     {
      if(VerboseLog)
         PrintFormat("[FxJournal] 送信しました (HTTP %d)", status);
      return(true);
     }

   PrintFormat("[FxJournal] サーバーが受け付けませんでした (HTTP %d): %s",
               status, CharArrayToString(result, 0, WHOLE_ARRAY, CP_UTF8));
   return(false);
  }
//+------------------------------------------------------------------+
