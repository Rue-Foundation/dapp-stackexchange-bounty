"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var core_1 = require('@angular/core');
var http_1 = require('@angular/http');
var index_1 = require('../question/index');
var index_2 = require('../web3/index');
var Rx_1 = require('rxjs/Rx');
var QuestionsService = (function () {
    function QuestionsService(web3Service, http) {
        this.web3Service = web3Service;
        this.http = http;
        this.update = new core_1.EventEmitter();
        this.key = 'HDX)Uk7cBWAecbA8AaCS)A((';
        this.questions = [];
        this.start = 0;
        this.sortType = 'Date';
        this.failed = 0;
        this.rate = 1;
    }
    QuestionsService.prototype.loadQuestions = function (start, end) {
        var _this = this;
        this.end = end;
        for (var i = start - 1; i >= end; i--) {
            this.fetchQuestion(i).then(function (question) {
                if (question) {
                    _this.pushQuestion(question);
                }
                else {
                    _this.loadQuestions(_this.end, _this.end - 1);
                }
            });
        }
    };
    QuestionsService.prototype.initialize = function () {
        var _this = this;
        this.getETHUSD().then(function (rate) {
            _this.rate = rate;
        });
        this.web3Service.getNumQuestions().then(function (numQuestions) {
            _this.numQuestions = numQuestions;
            console.log(numQuestions);
            var toFetch = (_this.numQuestions <= 5) ? _this.numQuestions : 5;
            toFetch = (typeof _this.end !== 'undefined') ? _this.end : _this.numQuestions - toFetch;
            _this.loadQuestions(_this.numQuestions, toFetch);
        });
    };
    QuestionsService.prototype.loadMore = function () {
        var toFetch = (this.end <= 5) ? this.end : 5;
        if (toFetch > 0) {
            this.loadQuestions(this.end, this.end - toFetch);
            return true;
        }
        return false;
    };
    QuestionsService.prototype.totalBounty = function (sponsors) {
        var total = 0;
        for (var i = 0; i < sponsors.length; i++) {
            total += sponsors[i].amount;
        }
        return total;
    };
    QuestionsService.prototype.fetchQuestion = function (index) {
        var _this = this;
        var p = new Promise(function (resolve, reject) {
            _this.web3Service.getQuestion(index).then(function (rawQuestion) {
                rawQuestion = JSON.parse(JSON.stringify(rawQuestion));
                var id = rawQuestion[2];
                var site = rawQuestion[1];
                if (id !== 0 && site !== '') {
                    if (!_this.getQuestionFromCache(id, site)) {
                        _this.getQuestionFromApi(id, site).subscribe(function (data) {
                            var exists = data.items.length > 0;
                            if (exists) {
                                localStorage[id + '&&' + site] = JSON.stringify(data);
                                _this.getSponsors(index, rawQuestion[0]).then(function (sponsors) {
                                    var totalBounty = _this.totalBounty(sponsors);
                                    var question = new index_1.Question(rawQuestion, data, sponsors, totalBounty, index);
                                    resolve(question);
                                });
                            }
                        });
                    }
                }
                else {
                    _this.failed++;
                    resolve(false);
                }
            });
        });
        return p;
    };
    QuestionsService.prototype.extractData = function (response) {
        var body = response.json();
        return body || {};
    };
    QuestionsService.prototype.handleError = function (error) {
        var errMsg = (error.message) ? error.message :
            error.status ? error.status + " - " + error.statusText : 'Server error';
        console.log(errMsg);
        return Rx_1.Observable.throw(errMsg);
    };
    QuestionsService.prototype.getQuestionFromApi = function (id, site) {
        var url = 'https://api.stackexchange.com/2.2/questions/' + id + '?site=' + site + '&key=' + this.key + '&filter=withbody';
        var stored = localStorage[id + '&&' + site];
        if (!stored) {
            return this.http.get(url)
                .map(this.extractData)
                .catch(this.handleError);
        }
        else {
            return Rx_1.Observable.of(stored).map(function (data) { return JSON.parse(data); });
        }
    };
    QuestionsService.prototype.getETHUSD = function () {
        var _this = this;
        var p = new Promise(function (resolve, reject) {
            _this.http.get('https://min-api.cryptocompare.com/data/price?fsym=ETH&tsyms=USD')
                .map(_this.extractData)
                .catch(_this.handleError)
                .subscribe(function (data) {
                resolve(data.USD);
            });
        });
        return p;
    };
    QuestionsService.prototype.getQuestionFromCache = function (id, site) {
        var question;
        for (var i = 0; i < this.questions.length; i++) {
            if (this.questions[i].questionID === id && this.questions[i].site === site) {
                question = this.questions[i];
            }
        }
        return question;
    };
    QuestionsService.prototype.getQuestionBySiteId = function (id, site) {
        var _this = this;
        var p = new Promise(function (resolve, reject) {
            _this.web3Service.getQuestionAddr(id, site).then(function (addr) {
                _this.web3Service.getQuestionIndex(addr).then(function (index) {
                    _this.fetchQuestion(index).then(function (question) {
                        resolve(question);
                    });
                });
            });
        });
        return p;
    };
    QuestionsService.prototype.getSponsors = function (index, questionAddr) {
        var _this = this;
        var p = new Promise(function (resolve, reject) {
            _this.web3Service.getMainAddr(questionAddr).then(function (mainAddr) {
                _this.web3Service.getSponsorList(index, mainAddr).then(function (sponsorList) {
                    var sponsors = [];
                    sponsorList.forEach(function (sponsor) {
                        _this.web3Service.getSponsorBalance(index, sponsor, mainAddr).then(function (amount) {
                            sponsors.push({ address: sponsor, amount: _this.web3Service.weiToEth(amount) });
                            if (sponsors.length === sponsorList.length) {
                                resolve(sponsors);
                            }
                        });
                    });
                });
            });
        });
        return p;
    };
    QuestionsService.prototype.pushQuestion = function (question) {
        this.questions.push(question);
        this.sortQuestions();
        this.update.emit(null);
    };
    QuestionsService.prototype.addQuestion = function (url, amount) {
        var site = url.match('://(.*).stackexchange')[1];
        var id = url.match('stackexchange.com/questions/(.*)/')[1];
        return this.web3Service.addQuestion(url, site, id, amount);
    };
    QuestionsService.prototype.sortByDate = function () {
        this.questions.sort(function (a, b) {
            return b.expiryDate - a.expiryDate;
        });
    };
    QuestionsService.prototype.sortByBounty = function () {
        this.questions.sort(function (a, b) {
            return b.totalBounty - a.totalBounty;
        });
    };
    QuestionsService.prototype.sortQuestions = function () {
        if (this.sortType === 'Date') {
            this.sortByDate();
        }
        else if (this.sortType === 'Bounty') {
            this.sortByBounty();
        }
    };
    QuestionsService.prototype.toggleSort = function () {
        if (this.sortType === 'Date') {
            this.sortType = 'Bounty';
        }
        else if (this.sortType === 'Bounty') {
            this.sortType = 'Date';
        }
        this.sortQuestions();
    };
    Object.defineProperty(QuestionsService.prototype, "visibleQuestions", {
        get: function () {
            return this.questions.slice(this.start, this.numQuestions - this.end + 1);
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(QuestionsService.prototype, "isReady", {
        get: function () {
            return (this.numQuestions - this.end) === this.questions.length + this.failed;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(QuestionsService.prototype, "sortingMethod", {
        get: function () {
            var method;
            if (this.sortType === 'Date') {
                method = 'Bounty';
            }
            else if (this.sortType === 'Bounty') {
                method = 'Date';
            }
            return method;
        },
        enumerable: true,
        configurable: true
    });
    __decorate([
        core_1.Output(), 
        __metadata('design:type', Object)
    ], QuestionsService.prototype, "update", void 0);
    QuestionsService = __decorate([
        core_1.Injectable(), 
        __metadata('design:paramtypes', [index_2.Web3Service, http_1.Http])
    ], QuestionsService);
    return QuestionsService;
}());
exports.QuestionsService = QuestionsService;

//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImFwcC9zaGFyZWQvcXVlc3Rpb25zL3F1ZXN0aW9ucy5zZXJ2aWNlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7QUFBQSxxQkFBaUQsZUFBZSxDQUFDLENBQUE7QUFDakUscUJBQStCLGVBQWUsQ0FBQyxDQUFBO0FBQy9DLHNCQUF5QixtQkFBbUIsQ0FBQyxDQUFBO0FBQzdDLHNCQUE0QixlQUFlLENBQUMsQ0FBQTtBQUM1QyxtQkFBMkIsU0FBUyxDQUFDLENBQUE7QUFHckM7SUFXSSwwQkFBb0IsV0FBd0IsRUFBVSxJQUFVO1FBQTVDLGdCQUFXLEdBQVgsV0FBVyxDQUFhO1FBQVUsU0FBSSxHQUFKLElBQUksQ0FBTTtRQVZ0RCxXQUFNLEdBQUcsSUFBSSxtQkFBWSxFQUFFLENBQUM7UUFDOUIsUUFBRyxHQUFHLDBCQUEwQixDQUFDO1FBQ2pDLGNBQVMsR0FBZSxFQUFFLENBQUM7UUFDM0IsVUFBSyxHQUFHLENBQUMsQ0FBQztRQUVWLGFBQVEsR0FBVyxNQUFNLENBQUM7UUFFMUIsV0FBTSxHQUFXLENBQUMsQ0FBQztRQUNuQixTQUFJLEdBQUcsQ0FBQyxDQUFDO0lBRW1ELENBQUM7SUFFckUsd0NBQWEsR0FBYixVQUFjLEtBQWEsRUFBRSxHQUFXO1FBQXhDLGlCQVdDO1FBVkcsSUFBSSxDQUFDLEdBQUcsR0FBRyxHQUFHLENBQUM7UUFDZixHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxLQUFLLEdBQUcsQ0FBQyxFQUFFLENBQUMsSUFBSSxHQUFHLEVBQUUsQ0FBQyxFQUFFLEVBQUUsQ0FBQztZQUNwQyxJQUFJLENBQUMsYUFBYSxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxVQUFDLFFBQVE7Z0JBQ2hDLEVBQUUsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUM7b0JBQ1gsS0FBSSxDQUFDLFlBQVksQ0FBQyxRQUFRLENBQUMsQ0FBQztnQkFDaEMsQ0FBQztnQkFBQyxJQUFJLENBQUMsQ0FBQztvQkFDSixLQUFJ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USxLQUFLLE1BQU0sQ0FBQyxDQUFDLENBQUM7Z0JBQzNCLE1BQU0sR0FBRyxRQUFRLENBQUM7WUFDdEIsQ0FBQztZQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsUUFBUSxLQUFLLFFBQVEsQ0FBQyxDQUFDLENBQUM7Z0JBQ3BDLE1BQU0sR0FBRyxNQUFNLENBQUM7WUFDcEIsQ0FBQztZQUNELE1BQU0sQ0FBQyxNQUFNLENBQUM7UUFDbEIsQ0FBQzs7O09BQUE7SUEvTkQ7UUFBQyxhQUFNLEVBQUU7O29EQUFBO0lBRmI7UUFBQyxpQkFBVSxFQUFFOzt3QkFBQTtJQWtPYix1QkFBQztBQUFELENBak9BLEFBaU9DLElBQUE7QUFqT1ksd0JBQWdCLG1CQWlPNUIsQ0FBQSIsImZpbGUiOiJhcHAvc2hhcmVkL3F1ZXN0aW9ucy9xdWVzdGlvbnMuc2VydmljZS5qcyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IEluamVjdGFibGUsIEV2ZW50RW1pdHRlciwgT3V0cHV0IH0gZnJvbSAnQGFuZ3VsYXIvY29yZSc7XG5pbXBvcnQgeyBIdHRwLCBSZXNwb25zZSB9IGZyb20gJ0Bhbmd1bGFyL2h0dHAnO1xuaW1wb3J0IHsgUXVlc3Rpb24gfSBmcm9tICcuLi9xdWVzdGlvbi9pbmRleCc7XG5pbXBvcnQgeyBXZWIzU2VydmljZSB9IGZyb20gJy4uL3dlYjMvaW5kZXgnO1xuaW1wb3J0IHsgT2JzZXJ2YWJsZSB9IGZyb20gJ3J4anMvUngnO1xuXG5ASW5qZWN0YWJsZSgpXG5leHBvcnQgY2xhc3MgUXVlc3Rpb25zU2VydmljZSB7XG4gICAgQE91dHB1dCgpIHVwZGF0ZSA9IG5ldyBFdmVudEVtaXR0ZXIoKTsgICAgLy8gRm9yIHdoZW4gd2UgbmVlZCB0byBmb3JjZSBhIHJlZnJlc2ggd2l0aCBDaGFuZ2VEZXRlY3RvclJlZlxuICAgIHByaXZhdGUga2V5ID0gJ0hEWClVazdjQldBZWNiQThBYUNTKUEoKCc7IC8vIE91ciBTRSBBUEkga2V5IChtb3ZlIHRoaXMgb3V0IGxhdGVyKVxuICAgIHByaXZhdGUgcXVlc3Rpb25zOiBRdWVzdGlvbltdID0gW107ICAgICAgIC8vIExpc3Qgb2YgcXVlc3Rpb24gb2JqZWN0cyB0byBkaXNwbGF5XG4gICAgcHJpdmF0ZSBzdGFydCA9IDA7ICAgICAgICAgICAgICAgICAgICAgICAgLy8gV2hlcmUgdG8gc3RhcnQgb3VyIHF1ZXJpZXMgaW4gb3VyIGxpc3RcbiAgICBwcml2YXRlIGVuZDsgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBXaGVyZSB0byBlbmQgb3VyIHF1ZXJpZXNcbiAgICBwcml2YXRlIHNvcnRUeXBlOiBzdHJpbmcgPSAnRGF0ZSc7ICAgICAgICAvLyBUeXBlIG9mIHNvcnQgdG8gcGVyZm9ybVxuICAgIHByaXZhdGUgbnVtUXVlc3Rpb25zOiBudW1iZXI7ICAgICAgICAgICAgIC8vIFRvdGFsIHF1ZXN0aW9uc1xuICAgIHByaXZhdGUgZmFpbGVkOiBudW1iZXIgPSAwOyAgICAgICAgICAgICAgIC8vIE51bWJlciBvZiBmYWlsZWQgcXVlc3Rpb25zXG4gICAgcHJpdmF0ZSByYXRlID0gMTsgICAgICAgICAgICAgICAgICAgICAgICAgLy8gVVNEIHBlciBFVEggcmF0ZVxuXG4gICAgY29uc3RydWN0b3IocHJpdmF0ZSB3ZWIzU2VydmljZTogV2ViM1NlcnZpY2UsIHByaXZhdGUgaHR0cDogSHR0cCkgeyB9XG5cbiAgICBsb2FkUXVlc3Rpb25zKHN0YXJ0OiBudW1iZXIsIGVuZDogbnVtYmVyKTogdm9pZCB7XG4gICAgICAgIHRoaXMuZW5kID0gZW5kO1xuICAgICAgICBmb3IgKGxldCBpID0gc3RhcnQgLSAxOyBpID49IGVuZDsgaS0tKSB7IC8vIEZldGNoaW5nIGJhY2t3YXJkcyB0byBnZXQgdGhlIG1vc3QgcmVjZW50IHF1ZXN0aW9uc1xuICAgICAgICAgICAgdGhpcy5mZXRjaFF1ZXN0aW9uKGkpLnRoZW4oKHF1ZXN0aW9uKSA9PiB7XG4gICAgICAgICAgICAgICAgaWYgKHF1ZXN0aW9uKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMucHVzaFF1ZXN0aW9uKHF1ZXN0aW9uKTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmxvYWRRdWVzdGlvbnModGhpcy5lbmQsIHRoaXMuZW5kIC0gMSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBpbml0aWFsaXplKCk6IHZvaWQge1xuICAgICAgICB0aGlzLmdldEVUSFVTRCgpLnRoZW4oKHJhdGUpID0+IHtcbiAgICAgICAgICAgIHRoaXMucmF0ZSA9IHJhdGU7XG4gICAgICAgIH0pO1xuICAgICAgICB0aGlzLndlYjNTZXJ2aWNlLmdldE51bVF1ZXN0aW9ucygpLnRoZW4oKG51bVF1ZXN0aW9ucykgPT4ge1xuICAgICAgICAgICAgdGhpcy5udW1RdWVzdGlvbnMgPSBudW1RdWVzdGlvbnM7XG4gICAgICAgICAgICBjb25zb2xlLmxvZyhudW1RdWVzdGlvbnMpO1xuICAgICAgICAgICAgbGV0IHRvRmV0Y2ggPSAodGhpcy5udW1RdWVzdGlvbnMgPD0gNSkgPyB0aGlzLm51bVF1ZXN0aW9ucyA6IDU7XG4gICAgICAgICAgICB0b0ZldGNoID0gKHR5cGVvZiB0aGlzLmVuZCAhPT0gJ3VuZGVmaW5lZCcpID8gdGhpcy5lbmQgOiB0aGlzLm51bVF1ZXN0aW9ucyAtIHRvRmV0Y2g7IC8vIEVpdGhlciBmZXRjaCB0byB0aGUgZW5kIG9yIGZldGNoIHdoYXQgd2Ugc2FpZCB3ZSB3b3VsZFxuICAgICAgICAgICAgdGhpcy5sb2FkUXVlc3Rpb25zKHRoaXMubnVtUXVlc3Rpb25zLCB0b0ZldGNoKTtcbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgbG9hZE1vcmUoKTogYm9vbGVhbiB7XG4gICAgICAgIGxldCB0b0ZldGNoID0gKHRoaXMuZW5kIDw9IDUpID8gdGhpcy5lbmQgOiA1OyAvLyBPbmx5IHdhbnQgdG8gZmV0Y2ggYSBtYXggb2YgNSBxdWVzdGlvbnNcbiAgICAgICAgaWYgKHRvRmV0Y2ggPiAwKSB7XG4gICAgICAgICAgICB0aGlzLmxvYWRRdWVzdGlvbnModGhpcy5lbmQsIHRoaXMuZW5kIC0gdG9GZXRjaCk7XG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gZmFsc2U7IC8vIE5vdGhpbmcgbGVmdCB0byBmZXRjaFxuICAgIH1cblxuICAgIHRvdGFsQm91bnR5KHNwb25zb3JzOiBhbnlbXSk6IG51bWJlciB7XG4gICAgICAgIGxldCB0b3RhbCA9IDA7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgc3BvbnNvcnMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIHRvdGFsICs9IHNwb25zb3JzW2ldLmFtb3VudDtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdG90YWw7XG4gICAgfVxuXG4gICAgZmV0Y2hRdWVzdGlvbihpbmRleDogbnVtYmVyKTogUHJvbWlzZTxhbnk+IHtcbiAgICAgICAgbGV0IHAgPSBuZXcgUHJvbWlzZTxhbnk+KChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgICAgICAgIHRoaXMud2ViM1NlcnZpY2UuZ2V0UXVlc3Rpb24oaW5kZXgpLnRoZW4oKHJhd1F1ZXN0aW9uKSA9PiB7XG4gICAgICAgICAgICAgICAgcmF3UXVlc3Rpb24gPSBKU09OLnBhcnNlKEpTT04uc3RyaW5naWZ5KHJhd1F1ZXN0aW9uKSk7XG4gICAgICAgICAgICAgICAgbGV0IGlkID0gcmF3UXVlc3Rpb25bMl07XG4gICAgICAgICAgICAgICAgbGV0IHNpdGUgPSByYXdRdWVzdGlvblsxXTtcbiAgICAgICAgICAgICAgICBpZiAoaWQgIT09IDAgJiYgc2l0ZSAhPT0gJycpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCF0aGlzLmdldFF1ZXN0aW9uRnJvbUNhY2hlKGlkLCBzaXRlKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5nZXRRdWVzdGlvbkZyb21BcGkoaWQsIHNpdGUpLnN1YnNjcmliZSgoZGF0YSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxldCBleGlzdHMgPSBkYXRhLml0ZW1zLmxlbmd0aCA+IDA7IC8vIERlY2lkZXMgaWYgdGhlIHF1ZXN0aW9uIGV4aXN0cyBvciB3YXMgZGVsZXRlZCBhZnRlciBiZWluZyBzdWJtaXR0ZWRcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoZXhpc3RzKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxvY2FsU3RvcmFnZVtpZCArICcmJicgKyBzaXRlXSA9IEpTT04uc3RyaW5naWZ5KGRhdGEpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmdldFNwb25zb3JzKGluZGV4LCByYXdRdWVzdGlvblswXSkudGhlbigoc3BvbnNvcnMpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxldCB0b3RhbEJvdW50eSA9IHRoaXMudG90YWxCb3VudHkoc3BvbnNvcnMpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbGV0IHF1ZXN0aW9uID0gbmV3IFF1ZXN0aW9uKHJhd1F1ZXN0aW9uLCBkYXRhLCBzcG9uc29ycywgdG90YWxCb3VudHksIGluZGV4KTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlc29sdmUocXVlc3Rpb24pO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuZmFpbGVkKys7XG4gICAgICAgICAgICAgICAgICAgIHJlc29sdmUoZmFsc2UpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9KTtcbiAgICAgICAgcmV0dXJuIHA7XG4gICAgfVxuXG4gICAgZXh0cmFjdERhdGEocmVzcG9uc2U6IFJlc3BvbnNlKTogYW55IHtcbiAgICAgICAgbGV0IGJvZHkgPSByZXNwb25zZS5qc29uKCk7XG4gICAgICAgIHJldHVybiBib2R5IHx8IHt9O1xuICAgIH1cblxuICAgIGhhbmRsZUVycm9yKGVycm9yOiBhbnkpOiBhbnkge1xuICAgICAgICBsZXQgZXJyTXNnID0gKGVycm9yLm1lc3NhZ2UpID8gZXJyb3IubWVzc2FnZSA6XG4gICAgICAgICAgICBlcnJvci5zdGF0dXMgPyBgJHtlcnJvci5zdGF0dXN9IC0gJHtlcnJvci5zdGF0dXNUZXh0fWAgOiAnU2VydmVyIGVycm9yJztcbiAgICAgICAgY29uc29sZS5sb2coZXJyTXNnKTtcbiAgICAgICAgcmV0dXJuIE9ic2VydmFibGUudGhyb3coZXJyTXNnKTtcbiAgICB9XG5cbiAgICBnZXRRdWVzdGlvbkZyb21BcGkoaWQsIHNpdGUpOiBPYnNlcnZhYmxlPGFueT4ge1xuICAgICAgICBsZXQgdXJsID0gJ2h0dHBzOi8vYXBpLnN0YWNrZXhjaGFuZ2UuY29tLzIuMi9xdWVzdGlvbnMvJyArIGlkICsgJz9zaXRlPScgKyBzaXRlICsgJyZrZXk9JyArIHRoaXMua2V5ICsgJyZmaWx0ZXI9d2l0aGJvZHknO1xuICAgICAgICBsZXQgc3RvcmVkID0gbG9jYWxTdG9yYWdlW2lkICsgJyYmJyArIHNpdGVdOyAvLyBpZCYmc2l0ZSBoZXJlIGlzIGp1c3QgYSBmb3JtYXQgdG8gc2VhcmNoIGxvY2FsU3RvcmFnZVxuICAgICAgICBpZiAoIXN0b3JlZCkge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuaHR0cC5nZXQodXJsKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC5tYXAodGhpcy5leHRyYWN0RGF0YSlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAuY2F0Y2godGhpcy5oYW5kbGVFcnJvcik7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByZXR1cm4gT2JzZXJ2YWJsZS5vZihzdG9yZWQpLm1hcChkYXRhID0+IEpTT04ucGFyc2UoZGF0YSkpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0RVRIVVNEKCk6IFByb21pc2U8YW55PiB7XG4gICAgICAgIHZhciBwID0gbmV3IFByb21pc2U8YW55PigocmVzb2x2ZSxyZWplY3QpID0+IHtcbiAgICAgICAgICAgIHRoaXMuaHR0cC5nZXQoJ2h0dHBzOi8vbWluLWFwaS5jcnlwdG9jb21wYXJlLmNvbS9kYXRhL3ByaWNlP2ZzeW09RVRIJnRzeW1zPVVTRCcpXG4gICAgICAgICAgICAgICAgICAgICAgLm1hcCh0aGlzLmV4dHJhY3REYXRhKVxuICAgICAgICAgICAgICAgICAgICAgIC5jYXRjaCh0aGlzLmhhbmRsZUVycm9yKVxuICAgICAgICAgICAgICAgICAgICAgIC5zdWJzY3JpYmUoKGRhdGE6IGFueSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICByZXNvbHZlKGRhdGEuVVNEKTtcbiAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgcmV0dXJuIHA7XG4gICAgfVxuXG4gICAgZ2V0UXVlc3Rpb25Gcm9tQ2FjaGUoaWQ6IHN0cmluZywgc2l0ZTogc3RyaW5nKTogUXVlc3Rpb24ge1xuICAgICAgICBsZXQgcXVlc3Rpb247XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5xdWVzdGlvbnMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGlmICh0aGlzLnF1ZXN0aW9uc1tpXS5xdWVzdGlvbklEID09PSBpZCAmJiB0aGlzLnF1ZXN0aW9uc1tpXS5zaXRlID09PSBzaXRlKSB7XG4gICAgICAgICAgICAgICAgcXVlc3Rpb24gPSB0aGlzLnF1ZXN0aW9uc1tpXTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBxdWVzdGlvbjtcbiAgICB9XG5cbiAgICBnZXRRdWVzdGlvbkJ5U2l0ZUlkKGlkOiBzdHJpbmcsIHNpdGU6IHN0cmluZyk6IFByb21pc2U8YW55PiB7XG4gICAgICAgIGxldCBwID0gbmV3IFByb21pc2U8YW55PigocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICAgICAgICB0aGlzLndlYjNTZXJ2aWNlLmdldFF1ZXN0aW9uQWRkcihpZCwgc2l0ZSkudGhlbigoYWRkcikgPT4ge1xuICAgICAgICAgICAgICAgIHRoaXMud2ViM1NlcnZpY2UuZ2V0UXVlc3Rpb25JbmRleChhZGRyKS50aGVuKChpbmRleCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmZldGNoUXVlc3Rpb24oaW5kZXgpLnRoZW4oKHF1ZXN0aW9uKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXNvbHZlKHF1ZXN0aW9uKTtcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgcmV0dXJuIHA7XG4gICAgfVxuXG4gICAgZ2V0U3BvbnNvcnMoaW5kZXg6IG51bWJlciwgcXVlc3Rpb25BZGRyOiBzdHJpbmcpOiBQcm9taXNlPGFueT4ge1xuICAgICAgICBsZXQgcCA9IG5ldyBQcm9taXNlPGFueT4oKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICAgICAgdGhpcy53ZWIzU2VydmljZS5nZXRNYWluQWRkcihxdWVzdGlvbkFkZHIpLnRoZW4oKG1haW5BZGRyKSA9PiB7XG4gICAgICAgICAgICAgICAgdGhpcy53ZWIzU2VydmljZS5nZXRTcG9uc29yTGlzdChpbmRleCwgbWFpbkFkZHIpLnRoZW4oKHNwb25zb3JMaXN0KSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGxldCBzcG9uc29ycyA9IFtdO1xuICAgICAgICAgICAgICAgICAgICBzcG9uc29yTGlzdC5mb3JFYWNoKChzcG9uc29yKSA9PiB7IC8vIGZvckVhY2ggdG8gZW5zdXJlIGFzeW5jIGRvZXNuJ3QgYnJlYWsgdGhpbmdzXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLndlYjNTZXJ2aWNlLmdldFNwb25zb3JCYWxhbmNlKGluZGV4LCBzcG9uc29yLCBtYWluQWRkcikudGhlbigoYW1vdW50KSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgc3BvbnNvcnMucHVzaCh7YWRkcmVzczogc3BvbnNvciwgYW1vdW50OiB0aGlzLndlYjNTZXJ2aWNlLndlaVRvRXRoKGFtb3VudCl9KTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoc3BvbnNvcnMubGVuZ3RoID09PSBzcG9uc29yTGlzdC5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVzb2x2ZShzcG9uc29ycyk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIHJldHVybiBwO1xuICAgIH1cblxuICAgIHB1c2hRdWVzdGlvbihxdWVzdGlvbjogUXVlc3Rpb24pOiB2b2lkIHtcbiAgICAgICAgdGhpcy5xdWVzdGlvbnMucHVzaChxdWVzdGlvbik7XG4gICAgICAgIHRoaXMuc29ydFF1ZXN0aW9ucygpO1xuICAgICAgICB0aGlzLnVwZGF0ZS5lbWl0KG51bGwpO1xuICAgIH1cblxuICAgIGFkZFF1ZXN0aW9uKHVybDogc3RyaW5nLCBhbW91bnQ6IG51bWJlcik6IGJvb2xlYW4ge1xuICAgICAgICBsZXQgc2l0ZSA9IHVybC5tYXRjaCgnOi8vKC4qKS5zdGFja2V4Y2hhbmdlJylbMV07XG4gICAgICAgIGxldCBpZCA9IHVybC5tYXRjaCgnc3RhY2tleGNoYW5nZS5jb20vcXVlc3Rpb25zLyguKikvJylbMV07XG4gICAgICAgIHJldHVybiB0aGlzLndlYjNTZXJ2aWNlLmFkZFF1ZXN0aW9uKHVybCwgc2l0ZSwgaWQsIGFtb3VudCk7XG4gICAgfVxuXG4gICAgc29ydEJ5RGF0ZSgpOiB2b2lkIHtcbiAgICAgICAgdGhpcy5xdWVzdGlvbnMuc29ydCgoYSwgYikgPT4ge1xuICAgICAgICAgICAgcmV0dXJuIGIuZXhwaXJ5RGF0ZSAtIGEuZXhwaXJ5RGF0ZTtcbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgc29ydEJ5Qm91bnR5KCk6IHZvaWQge1xuICAgICAgICB0aGlzLnF1ZXN0aW9ucy5zb3J0KChhLCBiKSA9PiB7XG4gICAgICAgICAgICByZXR1cm4gYi50b3RhbEJvdW50eSAtIGEudG90YWxCb3VudHk7XG4gICAgICAgIH0pO1xuICAgIH1cblxuICAgIHNvcnRRdWVzdGlvbnMoKTogdm9pZCB7XG4gICAgICAgIGlmICh0aGlzLnNvcnRUeXBlID09PSAnRGF0ZScpIHtcbiAgICAgICAgICAgIHRoaXMuc29ydEJ5RGF0ZSgpO1xuICAgICAgICB9IGVsc2UgaWYgKHRoaXMuc29ydFR5cGUgPT09ICdCb3VudHknKSB7XG4gICAgICAgICAgICB0aGlzLnNvcnRCeUJvdW50eSgpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgdG9nZ2xlU29ydCgpOiB2b2lkIHtcbiAgICAgICAgaWYgKHRoaXMuc29ydFR5cGUgPT09ICdEYXRlJykge1xuICAgICAgICAgICAgdGhpcy5zb3J0VHlwZSA9ICdCb3VudHknO1xuICAgICAgICB9IGVsc2UgaWYgKHRoaXMuc29ydFR5cGUgPT09ICdCb3VudHknKSB7XG4gICAgICAgICAgICB0aGlzLnNvcnRUeXBlID0gJ0RhdGUnO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuc29ydFF1ZXN0aW9ucygpO1xuICAgIH1cblxuICAgIGdldCB2aXNpYmxlUXVlc3Rpb25zKCk6IFF1ZXN0aW9uW10ge1xuICAgICAgICByZXR1cm4gdGhpcy5xdWVzdGlvbnMuc2xpY2UodGhpcy5zdGFydCwgdGhpcy5udW1RdWVzdGlvbnMgLSB0aGlzLmVuZCArIDEpO1xuICAgIH1cblxuICAgIGdldCBpc1JlYWR5KCk6IGJvb2xlYW4ge1xuICAgICAgICByZXR1cm4gKHRoaXMubnVtUXVlc3Rpb25zIC0gdGhpcy5lbmQpID09PSB0aGlzLnF1ZXN0aW9ucy5sZW5ndGggKyB0aGlzLmZhaWxlZDsgLy8gSGF2ZSB3ZSBsb2FkZWQgZXZlcnl0aGluZyB3ZSBzYWlkIHdlIHdvdWxkP1xuICAgIH1cblxuICAgIGdldCBzb3J0aW5nTWV0aG9kKCk6IHN0cmluZyB7XG4gICAgICAgIGxldCBtZXRob2Q7XG4gICAgICAgIGlmICh0aGlzLnNvcnRUeXBlID09PSAnRGF0ZScpIHtcbiAgICAgICAgICAgIG1ldGhvZCA9ICdCb3VudHknO1xuICAgICAgICB9IGVsc2UgaWYgKHRoaXMuc29ydFR5cGUgPT09ICdCb3VudHknKSB7XG4gICAgICAgICAgICBtZXRob2QgPSAnRGF0ZSc7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG1ldGhvZDtcbiAgICB9XG59XG4iXX0=