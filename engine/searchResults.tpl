<!DOCTYPE html>
<html>
<head>
	<meta http-equiv="Content-Type" content="text/html; charset=utf-8">
	<meta http-equiv="X-UA-Compatible" content="IE=EDGE" />
	<style>
		*{
			margin: 0;
			padding: 0;
		}
		body{
			font-family: Arial, 'Helvetica Neue', Helvetica, sans-serif;
			background: #fff;
			color: #333;
			position: relative;
		}
		.wrapper{
			max-width: 850px;
			min-width: 320px;
			margin: 0 auto;
			padding: 110px 20px 0;
			position: relative;
			box-sizing: border-box;
		}
		.top-title{
			font-size: 12px;
			padding: .4em 20px;
		}
		.error{
			font-size: 12px;
			color: #cc3300;
			padding: .4em 20px;
		}
		a {
			text-decoration: none;
			color: #0000ff;
			outline: none;
		}
		a:hover {
			text-decoration: underline;
		}
		ul{
			border: 1px solid #cc3300;
			padding: 0 20px;
			list-style: none;
			margin: 5px 0;
			font-size: 14px;
		}
		ul li{
			padding: 10px 0;
			border-bottom: 1px solid #ccc;
			list-style: none;
		}
		.right-to-left ul li{
			direction: rtl;
		}
		ul li:last-of-type{
			border-bottom: none;
			text-align: center;
		}
		ul li:last-of-type a{
			display: inline-block;
			padding: 0 20px;

		}
		.book-title{
			white-space: nowrap;
			overflow: hidden;
			text-overflow: ellipsis;
			font-size: 18px;
			padding: .2em 0;
		}
		.book-author{
			white-space: nowrap;
			overflow: hidden;
			text-overflow: ellipsis;
			font-size: 14px;
			padding: .2em 0;
		}
		.book-link{
			white-space: nowrap;
			overflow: hidden;
			text-overflow: ellipsis;
		}
		.book-title a,
		.book-author a,
		.book-link a,
		p a {
			text-decoration: none;
			color: #333;
			outline: none;
		}
		.book-title a:hover,
		.book-author a:hover,
		.book-link a:hover,
		p a:hover {
			text-decoration: none;
		}
		p{
			line-height: 22px;
		}
        p strong{
            background-color: #ffffaa;
        }
		.bottom-links{
			text-align: right;
		}
		.right-to-left .bottom-links{
			text-align: left;
			direction: ltr;
		}
		.bottom-links a i{
			display: inline-block;
			margin-left: 10px;
			width: 16px;
			height: 16px;
			vertical-align: top;
			margin-right: 3px;
		}
		.bottom-links a i.pdf{
			background: url(../search/images/ico_1.png) no-repeat;
		}
		.bottom-links a i.word{
			background: url(../search/images/ico_2.png) no-repeat;
		}
		.bottom-links a i.html{
			background: url(../search/images/ico_3.png) no-repeat;
		}
		.search-input-block{
			position: absolute;
			left: 20px;
			right: 20px;
			top: 30px;
			box-shadow: 0 0 20px rgba(0, 0, 0, .3);
			padding: 1px;
			border-radius: 5px;
			background: #ececec; /* Old browsers */
			background: -moz-linear-gradient(top,  #ececec 0%, #909090 100%); /* FF3.6+ */
			background: -webkit-gradient(linear, left top, left bottom, color-stop(0%,#ececec), color-stop(100%,#909090)); /* Chrome,Safari4+ */
			background: -webkit-linear-gradient(top,  #ececec 0%,#909090 100%); /* Chrome10+,Safari5.1+ */
			background: -o-linear-gradient(top,  #ececec 0%,#909090 100%); /* Opera 11.10+ */
			background: -ms-linear-gradient(top,  #ececec 0%,#909090 100%); /* IE10+ */
			background: linear-gradient(to bottom,  #ececec 0%,#909090 100%); /* W3C */
			filter: progid:DXImageTransform.Microsoft.gradient( startColorstr='#ececec', endColorstr='#909090',GradientType=0 ); /* IE6-9 */
		}
		.search-input-block .search-input-block-wrapp{
			background: #fff;
			border-radius: 5px;
			height: 58px;
		}
		.search-input-block .search-input-block-wrapp table {
			width: 100%;
			border-collapse: collapse;
		}
		.search-input-block .search-input-block-wrapp table td {
			position: relative;
			padding: 2px;
		}
		.search-input-block .search-input-block-wrapp .field{
			font-family: Arial, 'Helvetica Neue', Helvetica, sans-serif;
			background: transparent;
			color: #333;
			border: none;
			outline: none;
			width: 100%;
			font-size: 32px;
		}

		.right-to-left .search-input-block .search-input-block-wrapp .field{
			direction: rtl;
		}
		.search-input-block .search-input-block-wrapp .bttn{
			font-family: Arial, 'Helvetica Neue', Helvetica, sans-serif;
			background: transparent;
			color: #333;
			border: none;
			outline: none;
			width: 114px;
			height: 54px;
			/* position: absolute;
			right: 0;
			top: 0; */
			text-align: center;
			overflow: hidden;
			text-overflow: ellipsis;
			border-radius: 5px;
			cursor: pointer;
			font-size: 32px;
		}
		.search-input-block .search-input-block-wrapp .bttn:hover{
			background: #ccc;
		}
		.search-input-block .search-input-block-wrapp i{
			width: 54px;
			height: 54px;
			display: block;
			cursor: pointer;
			/* position: absolute;
			top: 0; */
		}
		.search-input-block .search-input-block-wrapp .brand-ico{
			background: url(../search/images/ico_search.png) no-repeat;
			background-size: 35px;
			background-position: center;
			left: 0;
		}
		.search-input-block .search-input-block-wrapp .clear-ico{
			background: url(../search/images/close.svg) no-repeat;
			background-size: 20px;
			background-position: center;
			right: 60px;
		}
    </style>
</head>
<body class="{{#lang.ar}}right-to-left{{/lang.ar}}{{#lang.fa}}right-to-left{{/lang.fa}}">
	<div class="wrapper">
		<div class="search-input-block">
			<form method="get" action="" dir="auto">
				<div class="search-input-block-wrapp">
					<table>
						<tr>
							{{#lang.ar}}
								<td>
					            	<input type="submit" class="bttn" value="{{#lang.en}}Search{{/lang.en}}{{#lang.ar}}بحث{{/lang.ar}}{{#lang.fa}} جستجو {{/lang.fa}}" dir="auto">
					            </td>
							{{/lang.ar}}
							{{#lang.fa}}
								<td>
					            	<input type="submit" class="bttn" value="{{#lang.en}}Search{{/lang.en}}{{#lang.ar}}بحث{{/lang.ar}}{{#lang.fa}} جستجو {{/lang.fa}}" dir="auto">
					            </td>
							{{/lang.fa}}
							{{#lang.en}}
								<td>
									<i class="brand-ico"></i>
								</td>
							{{/lang.en}}
							<td width="100%">
								<input type="hidden" name="lang" value="{{params.lang}}">
				                <input type="hidden" name="clientID" value="{{params.clientID}}">
				                <input type="hidden" name="html" value="1">
				            	<input type="text" class="field" name="q" value="{{params.q}}" dir="auto">
				            </td>
				            {{#lang.ar}}
								<td>
									<i class="brand-ico"></i>
								</td>
							{{/lang.ar}}
							{{#lang.fa}}
								<td>
									<i class="brand-ico"></i>
								</td>
							{{/lang.fa}}
							{{#lang.en}}
								<td>
					            	<input type="submit" class="bttn" value="{{#lang.en}}Search{{/lang.en}}{{#lang.ar}}بحث{{/lang.ar}}{{#lang.fa}} جستجو {{/lang.fa}}" dir="auto">
					            </td>
							{{/lang.en}}
						</tr>
					</table>



	            	<!--<i class="clear-ico"></i>-->
	            </div>
            </form>
		</div>
		<!--<div class="top-title">-->
			<!--<span>x</span> matching sentences found in <span>x</span> books-->
		<!--</div>-->
		{{^hideResults}}
		<ul>
			{{#results}}
			<li>
				<div class="book-title"><a href="{{originalPath.htm.path}}#{{sentenceNumber}}" dir="auto">{{title}}</a></div>
			    <div class="book-author"><a href="{{originalPath.htm.path}}#{{sentenceNumber}}" dir="auto">{{author}}</a></div>
				<p><a href="{{originalPath.htm.path}}#{{sentenceNumber}}" dir="auto">{{{sentence}}}</a></p>
			    <div class="book-link"><a href="{{originalPath.htm.path}}#{{sentenceNumber}}">{{originalPath.htm.path}}</a></div>
			    <div class="bottom-links">
                    {{#originalPath.pdf}}<a href="{{path}}"><i class="pdf"></i>PDF</a>{{/originalPath.pdf}}
                    {{#originalPath.doc}}<a href="{{path}}"><i class="word"></i>Word</a>{{/originalPath.doc}}
                    {{#originalPath.htm}}<a href="{{path}}"><i class="html"></i>HTML</a>{{/originalPath.htm}}
			    </div>
			</li>
			{{/results}}
			<li>{{#prevPage}}<a href="?html=1&lang={{params.lang}}&q={{params.q}}&page={{page}}">Prev</a>{{/prevPage}}{{#nextPage}}<a href="?html=1&lang={{params.lang}}&q={{params.q}}&page={{page}}">Next</a>{{/nextPage}}</li>
		</ul>
		{{/hideResults}}
		{{^somethingFound}}
			<div class="error">{{#lang.en}}Nothing found{{/lang.en}}{{#lang.ar}}وجدت شيئا{{/lang.ar}}{{#lang.fa}}هیچ چیز پیدا نشد{{/lang.fa}}</div>
		{{/somethingFound}}
	</div>
</body>
</html>